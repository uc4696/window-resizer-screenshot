import { MAX_SIZE_FALLBACK, MIN_SIZE } from "./constants"
import { t } from "./i18n"
import { placeWindow, type WorkArea } from "./placement"
import { getSettings } from "./storage"
import type { DisplayBounds, ValidationResult } from "./types"

/**
 * 現在のディスプレイ（アクティブウィンドウが乗っているディスプレイ）の
 * 解像度を取得する。取得できない場合はフォールバック値を返す。
 */
export async function getCurrentDisplayBounds(): Promise<DisplayBounds> {
  // system.display 権限を使わず、ポップアップが表示されているディスプレイの
  // 解像度（window.screen）を参照する。
  const width = window.screen?.width
  const height = window.screen?.height
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height }
  }
  return { width: MAX_SIZE_FALLBACK, height: MAX_SIZE_FALLBACK }
}

/**
 * カスタムサイズ入力のバリデーション。
 * 現在のディスプレイ解像度を基準に、現実的な最大値・最小値をチェックする。
 */
export function validateSize(
  width: number,
  height: number,
  display: DisplayBounds
): ValidationResult {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { valid: false, error: t("errSizeNumeric") }
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { valid: false, error: t("errSizeInteger") }
  }
  if (width < MIN_SIZE || height < MIN_SIZE) {
    return {
      valid: false,
      error: t("errSizeMin", { min: MIN_SIZE })
    }
  }
  if (width > display.width || height > display.height) {
    return {
      valid: false,
      error: t("errSizeMax", { width: display.width, height: display.height })
    }
  }
  return { valid: true }
}

/**
 * オフセット値（補正値）のバリデーション。
 * 整数かつ極端すぎない範囲（-500px 〜 500px）を許容する。
 */
export function validateOffset(
  offsetWidth: number,
  offsetHeight: number
): ValidationResult {
  if (!Number.isFinite(offsetWidth) || !Number.isFinite(offsetHeight)) {
    return { valid: false, error: t("errOffsetNumeric") }
  }
  if (!Number.isInteger(offsetWidth) || !Number.isInteger(offsetHeight)) {
    return { valid: false, error: t("errOffsetInteger") }
  }
  if (
    offsetWidth < -500 ||
    offsetWidth > 500 ||
    offsetHeight < -500 ||
    offsetHeight > 500
  ) {
    return {
      valid: false,
      error: t("errOffsetRange")
    }
  }
  return { valid: true }
}

/**
 * ウィンドウが乗っているディスプレイのサイズをタブから読む（service worker 用）。
 * 注入できないページ（chrome:// 等）では null を返す。
 */
export async function readDisplayFromTab(tabId: number): Promise<DisplayBounds | null> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ width: window.screen.width, height: window.screen.height })
    })
    return result ?? null
  } catch {
    return null
  }
}

/**
 * リサイズの対象。popup は省略して「現在のウィンドウとアクティブタブ」を使う。
 * service worker（ショートカット）には現在のウィンドウがないので、対象を明示する。
 */
export interface ResizeTarget {
  tabId: number
  windowId: number
  url?: string
}

/**
 * ウィンドウが乗っているディスプレイの作業領域を取得する（system.display 権限は使わない）。
 * popup ではその画面の window.screen を、service worker ではタブに注入して読む。
 * 注入できないページ（chrome:// 等）を service worker から扱うときは取得できず null を返す。
 */
async function readWorkArea(tabId?: number): Promise<WorkArea | null> {
  const read = () => {
    const s = window.screen as Screen & { availLeft: number; availTop: number }
    return {
      left: s.availLeft,
      top: s.availTop,
      width: s.availWidth,
      height: s.availHeight
    }
  }
  if (typeof window !== "undefined") return read()
  if (tabId === undefined) return null
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: read
    })
    return result ?? null
  } catch {
    return null
  }
}

/**
 * 面積の半分以上が画面の外に出るウィンドウを Chrome は受け付けない
 * （Bounds must be at least 50% within visible screen space）。この拒否を分かる言葉に置き換える。
 */
function toBoundsError(error: unknown, width: number, height: number): unknown {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("50%")
    ? new Error(t("errBoundsRejected", { width, height }))
    : error
}

/**
 * ウィンドウのサイズを変更する。設定が有効なら、指定のサイズはそのままで、
 * はみ出す分だけ位置をずらして画面内に収める（placeWindow）。
 */
async function updateWindowSize(
  win: chrome.windows.Window,
  width: number,
  height: number,
  tabId?: number
): Promise<void> {
  const windowId = win.id as number
  const { keepWindowOnScreen } = await getSettings()
  const area = keepWindowOnScreen ? await readWorkArea(tabId) : null
  if (!area) {
    await chrome.windows
      .update(windowId, { width, height, state: "normal" })
      .catch((error) => {
        throw toBoundsError(error, width, height)
      })
    return
  }

  // 最大化などの位置は元の位置ではないので、通常の状態に戻してから位置を読む
  const current =
    win.state === "normal"
      ? win
      : await chrome.windows
          .update(windowId, { state: "normal" })
          .then(() => chrome.windows.get(windowId))
  const position = { left: current.left ?? 0, top: current.top ?? 0 }
  const placed = placeWindow(position, { width, height }, area)
  try {
    await chrome.windows.update(windowId, { width, height, state: "normal", ...placed })
  } catch (error) {
    if (!placed) throw toBoundsError(error, width, height)
    // 右隣のモニターにまたがれば収まる場合など、動かさない方が通ることがある
    await chrome.windows
      .update(windowId, { width, height, state: "normal" })
      .catch(() => {
        throw toBoundsError(error, width, height)
      })
  }

  // Chrome の最小サイズなどで指定どおりにならなかったときは、実際のサイズで収め直す
  const actual = await chrome.windows.get(windowId)
  if (actual.width === width && actual.height === height) return
  const again = placeWindow(
    { left: actual.left ?? 0, top: actual.top ?? 0 },
    { width: actual.width ?? width, height: actual.height ?? height },
    area
  )
  if (again) await chrome.windows.update(windowId, again).catch(() => undefined)
}

/**
 * ウィンドウ全体のサイズ（ブラウザのUI枠含む）を指定サイズに変更する。
 * offsetWidth / offsetHeight が指定されている場合、その補正値を加算する。
 */
export async function resizeWindow(
  width: number,
  height: number,
  offsetWidth = 0,
  offsetHeight = 0,
  target?: ResizeTarget
) {
  const win = target
    ? await chrome.windows.get(target.windowId)
    : await chrome.windows.getCurrent()
  if (win.id === undefined) return
  await updateWindowSize(
    win,
    Math.round(width + offsetWidth),
    Math.round(height + offsetHeight),
    target?.tabId
  )
}

/**
 * スクリプト実行が許可されていない特殊なURLかを判定する。
 */
function isRestrictedUrl(url?: string): boolean {
  if (!url) return true
  const restrictedPrefixes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "devtools://",
    "view-source:"
  ]
  return restrictedPrefixes.some((prefix) => url.startsWith(prefix))
}

/**
 * ビューポート（コンテンツ表示領域）のサイズを指定サイズに変更する。
 * ウィンドウ全体サイズとビューポートサイズの差分（ブラウザUI枠）を測定し、
 * その差分を加算したウィンドウサイズに変更することでビューポートサイズを合わせる。
 */
export async function resizeViewport(
  width: number,
  height: number,
  target?: ResizeTarget
) {
  const win = target
    ? await chrome.windows.get(target.windowId)
    : await chrome.windows.getCurrent()
  if (win.id === undefined || win.width === undefined || win.height === undefined) {
    throw new Error(t("errWindowInfo"))
  }

  const [activeTab] = target
    ? []
    : await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = target?.tabId ?? activeTab?.id
  if (!tabId) {
    throw new Error(t("errNoActiveTab"))
  }

  if (isRestrictedUrl(target ? target.url : activeTab?.url)) {
    throw new Error(t("errRestrictedPage"))
  }

  let currentViewport: { width: number; height: number } | undefined
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        width: window.innerWidth,
        height: window.innerHeight
      })
    })
    currentViewport = results?.[0]?.result
  } catch (e) {
    throw new Error(
      t("errViewportFailed", {
        message: e instanceof Error ? e.message : String(e)
      }),
      { cause: e }
    )
  }

  if (!currentViewport) {
    throw new Error(t("errViewportUnavailable"))
  }

  const diffWidth = win.width - currentViewport.width
  const diffHeight = win.height - currentViewport.height

  await updateWindowSize(
    win,
    Math.round(width + diffWidth),
    Math.round(height + diffHeight),
    tabId
  )
}

/**
 * アクティブタブの拡大率を取得する（1 = 100%）。
 * tabs.getZoom は tabs 権限なしで使える。取得できないときは null を返す。
 */
export async function getActiveTabZoom(): Promise<{
  tabId: number
  zoom: number
} | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return null
  try {
    return { tabId: tab.id, zoom: await chrome.tabs.getZoom(tab.id) }
  } catch {
    return null
  }
}

/** 拡大率が 100% でないか（浮動小数の誤差は無視する）。 */
export function isZoomed(zoom: number): boolean {
  return Math.abs(zoom - 1) > 0.001
}

/**
 * タブの拡大率を 100% に戻す。setZoom(0) はブラウザ既定の拡大率に戻すため、
 * 既定が 100% 以外の環境も考慮して 1 を明示する。
 */
export async function resetTabZoom(tabId: number): Promise<void> {
  await chrome.tabs.setZoom(tabId, 1)
}

/** 現在のウィンドウの状態（normal / maximized / fullscreen など）を取得する */
export async function getCurrentWindowState(): Promise<string | undefined> {
  return (await chrome.windows.getCurrent()).state
}

/** 現在のウィンドウサイズを取得する */
export async function getCurrentWindowSize(): Promise<DisplayBounds> {
  const win = await chrome.windows.getCurrent()
  return { width: win.width ?? 0, height: win.height ?? 0 }
}

/**
 * ページに注入して、ビューポートのサイズを小数まで測る。
 * innerWidth は拡大中に整数へ丸められ、拡大率を掛けて戻すと 1〜3px ズレる
 * （拡大率 300% で 1280 が 1278 になる）。メディアクエリの判定は丸められないので、二分探索で求める。
 * 外部を参照せず、この中だけで完結させる。
 */
function measureViewportExact(): DisplayBounds {
  const search = (feature: string, max: number) => {
    let low = 0
    let high = max + 2
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2
      if (window.matchMedia(`(${feature}: ${middle}px)`).matches) low = middle
      else high = middle
    }
    return low
  }
  return {
    width: search("min-width", window.innerWidth),
    height: search("min-height", window.innerHeight)
  }
}

/**
 * 現在のアクティブタブのビューポートサイズを取得する。
 * ページの拡大率に左右されない、ウィンドウの中の表示エリアの実サイズを返す
 * （1280x720 のビューポートは、拡大率 150% でも 80% でも 1280x720）。
 */
export async function getCurrentViewportSize(): Promise<DisplayBounds> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    return { width: 0, height: 0 }
  }
  try {
    const [zoom, [{ result }]] = await Promise.all([
      chrome.tabs.getZoom(tab.id),
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: measureViewportExact
      })
    ])
    if (!result) return { width: 0, height: 0 }
    return {
      width: Math.round(result.width * zoom),
      height: Math.round(result.height * zoom)
    }
  } catch {
    return { width: 0, height: 0 }
  }
}
