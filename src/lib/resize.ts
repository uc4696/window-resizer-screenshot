import { MAX_SIZE_FALLBACK, MIN_SIZE } from "./constants"
import { t } from "./i18n"
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
 * ウィンドウ全体のサイズ（ブラウザのUI枠含む）を指定サイズに変更する。
 * offsetWidth / offsetHeight が指定されている場合、その補正値を加算する。
 */
export async function resizeWindow(
  width: number,
  height: number,
  offsetWidth = 0,
  offsetHeight = 0
) {
  const win = await chrome.windows.getCurrent()
  if (win.id === undefined) return
  await chrome.windows.update(win.id, {
    width: Math.round(width + offsetWidth),
    height: Math.round(height + offsetHeight),
    state: "normal"
  })
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
export async function resizeViewport(width: number, height: number) {
  const win = await chrome.windows.getCurrent()
  if (win.id === undefined || win.width === undefined || win.height === undefined) {
    throw new Error(t("errWindowInfo"))
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error(t("errNoActiveTab"))
  }

  if (isRestrictedUrl(tab.url)) {
    throw new Error(t("errRestrictedPage"))
  }

  let currentViewport: { width: number; height: number } | undefined
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
      })
    )
  }

  if (!currentViewport) {
    throw new Error(t("errViewportUnavailable"))
  }

  const diffWidth = win.width - currentViewport.width
  const diffHeight = win.height - currentViewport.height

  await chrome.windows.update(win.id, {
    width: Math.round(width + diffWidth),
    height: Math.round(height + diffHeight),
    state: "normal"
  })
}

/** 現在のウィンドウサイズを取得する */
export async function getCurrentWindowSize(): Promise<DisplayBounds> {
  const win = await chrome.windows.getCurrent()
  return { width: win.width ?? 0, height: win.height ?? 0 }
}

/** 現在のアクティブタブのビューポートサイズを取得する */
export async function getCurrentViewportSize(): Promise<DisplayBounds> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    return { width: 0, height: 0 }
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ width: window.innerWidth, height: window.innerHeight })
    })
    return result ?? { width: 0, height: 0 }
  } catch {
    return { width: 0, height: 0 }
  }
}

