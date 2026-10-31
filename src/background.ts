import { buildDownloadPath, buildScreenshotFilename } from "~lib/filename"
import { initI18n, t } from "~lib/i18n"
import type { CaptureRequest, CaptureResponse } from "~lib/messages"
import { captureFullPage, captureVisibleTab } from "~lib/screenshot"
import { getSettings } from "~lib/storage"

/** 結果のバッジ（OK / !）を表示しておく時間（ms）。 */
const BADGE_CLEAR_MS = 3000

const BADGES = {
  busy: { text: "...", color: "#6b7280" },
  ok: { text: "OK", color: "#16a34a" },
  error: { text: "!", color: "#dc2626" }
} as const

/** タブ単位でツールバーアイコンにバッジを出す。busy 以外は一定時間後に消す。 */
async function showBadge(tabId: number, kind: keyof typeof BADGES): Promise<void> {
  const badge = BADGES[kind]
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color })
  await chrome.action.setBadgeText({ tabId, text: badge.text })
  if (kind === "busy") return
  setTimeout(() => {
    // タブが閉じられていると失敗するので無視する
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined)
  }, BADGE_CLEAR_MS)
}

chrome.runtime.onMessage.addListener(
  (
    message: CaptureRequest,
    sender,
    sendResponse: (response: CaptureResponse) => void
  ) => {
    if (message?.type !== "capture-screenshot") return

    if (message.action !== "copy") {
      // 保存は popup を閉じてから行うため、受け付けた時点で応答し、結果はバッジで知らせる
      sendResponse({ ok: true })
      void handleDownloadWithBadge(message)
      return
    }

    handleCapture(message)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message ?? String(error) })
      )

    // 非同期処理のため true を返す
    return true
  }
)

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function handleDownloadWithBadge(message: CaptureRequest): Promise<void> {
  const tab = await getActiveTab()
  const tabId = tab?.id
  if (tabId !== undefined) await showBadge(tabId, "busy").catch(() => undefined)
  try {
    const response = await handleCapture(message)
    if (!response.ok) throw new Error(response.error)
    if (tabId !== undefined) await showBadge(tabId, "ok")
  } catch (error) {
    console.error("[capture]", error)
    if (tabId !== undefined) await showBadge(tabId, "error").catch(() => undefined)
  }
}

async function handleCapture(message: CaptureRequest): Promise<CaptureResponse> {
  // service worker は随時停止・再起動されるため、処理ごとに最新の言語設定を反映する
  await initI18n()

  const tab = await getActiveTab()
  if (!tab?.id || tab.windowId === undefined) {
    return { ok: false, error: t("errNoActiveTab") }
  }

  const settings = await getSettings()
  // クリップボードへコピーする場合は常に PNG（Chrome が確実に書き込める形式）
  const isCopy = message.action === "copy"
  const format = isCopy ? "png" : settings.imageFormat

  const dataUrl =
    message.mode === "full-page"
      ? await captureFullPage(tab.id, tab.windowId, format)
      : await captureVisibleTab(tab.windowId, format)

  if (isCopy) {
    return { ok: true, dataUrl }
  }

  const filename = buildScreenshotFilename(new Date(), format)
  const path = buildDownloadPath(settings.captureDirName, filename)

  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: path,
    saveAs: false,
    conflictAction: "uniquify"
  })

  return { ok: true, downloadId, filename }
}
