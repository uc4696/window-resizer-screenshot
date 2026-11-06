import { MAX_SIZE_FALLBACK, MIN_SIZE } from "./constants"
import { t } from "./i18n"
import {
  alignPosition,
  nextWindowSize,
  placeWindow,
  positionStep,
  snapToRequested,
  type FitAttempt,
  type WorkArea
} from "./placement"
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
}

/** 最後に指定したビューポートのサイズの保存先（ウィンドウごと、ブラウザを閉じるまで）。 */
function requestedViewportKey(windowId: number): string {
  return `requested-viewport-${windowId}`
}

/**
 * タブの描画エリアのサイズ。tabs.Tab の width / height は tabs 権限なしで読め、ページの拡大率に
 * 左右されず、chrome:// でも読める。最後に指定したサイズとの端数の差は指定のサイズに揃える。
 */
export async function getDrawingArea(
  tab: chrome.tabs.Tab
): Promise<{ actual: DisplayBounds; target: DisplayBounds } | null> {
  if (!tab.width || !tab.height) return null
  const actual = { width: tab.width, height: tab.height }
  const key = requestedViewportKey(tab.windowId)
  const stored = await chrome.storage.session.get(key)
  return {
    actual,
    target: snapToRequested(actual, stored[key] as DisplayBounds | undefined)
  }
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
 * 表示スケール（ページの拡大率を除いた値）を読む。
 * popup は自分の値、service worker はタブから読む。注入できないページでは null を返す。
 */
async function readDisplayScale(tabId?: number): Promise<number | null> {
  if (typeof window !== "undefined") return window.devicePixelRatio
  if (tabId === undefined) return null
  try {
    const [[{ result }], zoom] = await Promise.all([
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.devicePixelRatio
      }),
      chrome.tabs.getZoom(tabId)
    ])
    return result && zoom ? result / zoom : null
  } catch {
    return null
  }
}

/**
 * ウィンドウの枠の大きさ（ウィンドウとタブのサイズの差）。
 * popup 以外からはタブを渡す。読めなければ 0 とする。
 */
export async function getWindowFrame(tab?: chrome.tabs.Tab): Promise<DisplayBounds> {
  const [active] = tab
    ? [tab]
    : await chrome.tabs.query({ active: true, currentWindow: true })
  if (!active?.width || !active.height) return { width: 0, height: 0 }
  const win = await chrome.windows.get(active.windowId)
  return {
    width: Math.max(0, (win.width ?? active.width) - active.width),
    height: Math.max(0, (win.height ?? active.height) - active.height)
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
  tabId?: number,
  step = 1
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
  const fitted = placeWindow(position, { width, height }, area) ?? position
  const aligned = alignPosition(fitted, step, area)
  const placed =
    aligned.left === position.left && aligned.top === position.top ? null : aligned
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
  await chrome.storage.session.remove(requestedViewportKey(win.id))
}

/** ウィンドウのサイズを変えてから、タブのサイズを読むまでの待ち時間。 */
const FIT_SETTLE_MS = 100
/** タブのサイズを確かめて直す回数の上限。 */
const FIT_MAX_ATTEMPTS = 5

/**
 * タブのサイズを見ながら、幅と高さを別々に直す。届かない数は指定より大きい最小のサイズにする。
 * 前面にないタブのサイズは更新されないので、そのときは直さない。
 */
async function fitViewport(
  windowId: number,
  tabId: number,
  want: DisplayBounds,
  firstRequest: DisplayBounds,
  step: number
): Promise<void> {
  const win = await chrome.windows.get(windowId)
  const position =
    step > 1 && win.left !== undefined && win.top !== undefined
      ? alignPosition({ left: win.left, top: win.top }, step)
      : {}
  const widths: FitAttempt[] = []
  const heights: FitAttempt[] = []
  let request = firstRequest
  for (let attempt = 0; attempt < FIT_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, FIT_SETTLE_MS))
    const tab = await chrome.tabs.get(tabId)
    if (!tab.active || !tab.width || !tab.height) return
    widths.push({ request: request.width, actual: tab.width })
    heights.push({ request: request.height, actual: tab.height })
    const width = nextWindowSize(widths, want.width)
    const height = nextWindowSize(heights, want.height)
    if (width === null && height === null) return
    request = { width: width ?? request.width, height: height ?? request.height }
    try {
      await chrome.windows.update(windowId, { ...position, ...request })
    } catch {
      return // 最初の変更は済んでいるので、直せなくてもそのサイズのままにする
    }
  }
}

/**
 * ビューポート（コンテンツ表示領域）のサイズを指定サイズに変更する。
 * ウィンドウとタブのサイズの差（ブラウザのUI枠）を加えたウィンドウサイズに変更する。
 * タブのサイズはページの拡大率に左右されないので、拡大したままでも指定どおりになる。
 *
 * 端数の表示スケールでは丸めでサイズがズレるので、Windows と Linux では位置を揃えてから直す
 * （実機で測った環境に限る。macOS は整数のスケール、ChromeOS は未測定なので 1 回だけ変更する）。
 */
export async function resizeViewport(
  width: number,
  height: number,
  target?: ResizeTarget
) {
  const read = async () => {
    const win = target
      ? await chrome.windows.get(target.windowId)
      : await chrome.windows.getCurrent()
    const [tab] = target
      ? [await chrome.tabs.get(target.tabId)]
      : await chrome.tabs.query({ active: true, currentWindow: true })
    return { win, tab }
  }
  let { win, tab } = await read()
  if (win.id === undefined) throw new Error(t("errWindowInfo"))
  if (!tab?.id) throw new Error(t("errNoActiveTab"))

  // 最大化などでは枠の大きさが通常の状態と違うので、通常の状態に戻してから差を測る
  if (win.state !== "normal") {
    await chrome.windows.update(win.id, { state: "normal" })
    ;({ win, tab } = await read())
  }
  if (win.width === undefined || win.height === undefined) {
    throw new Error(t("errWindowInfo"))
  }
  if (!tab?.width || !tab.height) throw new Error(t("errViewportUnavailable"))

  const want = { width: Math.round(width), height: Math.round(height) }
  const { os } = await chrome.runtime.getPlatformInfo()
  const canFit = os === "win" || os === "linux"
  const scale = canFit ? await readDisplayScale(tab.id) : null
  const step = scale ? positionStep(scale) : 1
  const firstRequest = {
    width: want.width + win.width - tab.width,
    height: want.height + win.height - tab.height
  }
  await updateWindowSize(win, firstRequest.width, firstRequest.height, tab.id, step)
  // popup は途中で閉じることがあるので、直す前に記録する
  await chrome.storage.session.set({
    [requestedViewportKey(win.id as number)]: want
  })
  if (canFit)
    await fitViewport(win.id as number, tab.id as number, want, firstRequest, step)
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

/** 現在のアクティブタブのビューポート（描画エリア）のサイズを取得する。 */
export async function getCurrentViewportSize(): Promise<DisplayBounds> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const area = tab ? await getDrawingArea(tab) : null
  return area?.target ?? { width: 0, height: 0 }
}
