import { buildDownloadPath, buildScreenshotFilename } from "~lib/filename"
import { initI18n, t } from "~lib/i18n"
import type {
  BadgeKind,
  CaptureRequest,
  CaptureResponse,
  ExtensionMessage
} from "~lib/messages"
import {
  ensureInstalledAt,
  markReviewPromptOnUse,
  resetReviewPromptOnUpdate
} from "~lib/review-prompt"
import { captureFullPage, captureVisibleTab } from "~lib/screenshot"
import { getSettings } from "~lib/storage"

/** 結果のバッジ（OK / !）を表示しておく時間（ms）。 */
const BADGE_CLEAR_MS = 3000

const BADGES: Record<BadgeKind, { text: string; color: string }> = {
  busy: { text: "...", color: "#6b7280" },
  ok: { text: "OK", color: "#16a34a" },
  error: { text: "!", color: "#dc2626" }
}

/** タブ単位でツールバーアイコンにバッジを出す。busy 以外は一定時間後に消す。 */
async function showBadge(tabId: number, kind: BadgeKind): Promise<void> {
  const badge = BADGES[kind]
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color })
  await chrome.action.setBadgeText({ tabId, text: badge.text })
  if (kind === "busy") return
  setTimeout(() => {
    // タブが閉じられていると失敗するので無視する
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined)
  }, BADGE_CLEAR_MS)
}

// 評価のお願いの起点。service worker が起きるたびに、記録がなければ今を記録する
void ensureInstalledAt().catch((error) => console.warn("[review-prompt]", error))

// アップデートしたら、評価のお願いの「表示しない」を取り消す（評価した人はそのまま）
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== "update") return
  void resetReviewPromptOnUpdate().catch((error) =>
    console.warn("[review-prompt]", error)
  )
})

/** 撮影に成功したときに、評価のお願いの印を付ける（次に popup を開いたときに出す）。 */
function noteCaptureSucceeded(): void {
  void markReviewPromptOnUse().catch((error) => console.warn("[review-prompt]", error))
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: CaptureResponse) => void
  ) => {
    if (message?.type === "capture-badge") {
      if (sender.tab?.id !== undefined) {
        void showBadge(sender.tab.id, message.kind).catch(() => undefined)
      }
      return
    }
    if (message?.type !== "capture-screenshot") return

    // ページ上の範囲選択から来た依頼は送信元タブ、popup から来た依頼はアクティブタブが対象
    // （拡張機能のページはタブとして開かれていても対象にしない）
    const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL(""))
    const senderTab = fromExtensionPage ? undefined : sender.tab

    if (message.action !== "copy") {
      // 保存は popup を閉じてから行うため、受け付けた時点で応答し、結果はバッジで知らせる
      sendResponse({ ok: true })
      void handleDownloadWithBadge(message, senderTab)
      return
    }

    if (message.mode === "picked" && senderTab?.id !== undefined) {
      // 範囲選択からのコピーは popup が閉じているため、撮影中をバッジで示す（結果はページ側から届く）
      void showBadge(senderTab.id, "busy").catch(() => undefined)
    }
    handleCapture(message, senderTab)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message ?? String(error) })
      )

    // 非同期処理のため true を返す
    return true
  }
)

async function resolveTab(
  senderTab?: chrome.tabs.Tab
): Promise<chrome.tabs.Tab | undefined> {
  if (senderTab) return senderTab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function handleDownloadWithBadge(
  message: CaptureRequest,
  senderTab?: chrome.tabs.Tab
): Promise<void> {
  const tab = await resolveTab(senderTab)
  const tabId = tab?.id
  if (tabId !== undefined) await showBadge(tabId, "busy").catch(() => undefined)
  try {
    const response = await handleCapture(message, tab)
    if (!response.ok) throw new Error(response.error)
    if (tabId !== undefined) await showBadge(tabId, "ok")
  } catch (error) {
    console.error("[capture]", error)
    if (tabId !== undefined) await showBadge(tabId, "error").catch(() => undefined)
  }
}

async function handleCapture(
  message: CaptureRequest,
  senderTab?: chrome.tabs.Tab
): Promise<CaptureResponse> {
  // service worker は随時停止・再起動されるため、処理ごとに最新の言語設定を反映する
  await initI18n()

  const tab = await resolveTab(senderTab)
  if (!tab?.id || tab.windowId === undefined) {
    return { ok: false, error: t("errNoActiveTab") }
  }

  const settings = await getSettings()
  // クリップボードへコピーする場合は常に PNG（Chrome が確実に書き込める形式）
  const isCopy = message.action === "copy"
  const format = isCopy ? "png" : settings.imageFormat

  const dataUrl =
    message.mode === "visible"
      ? await captureVisibleTab(tab.windowId, format)
      : await captureFullPage(tab.id, tab.windowId, format, {
          picked: message.mode === "picked",
          includeFrame: settings.scrollAreaIncludeFrame
        })

  if (isCopy) {
    noteCaptureSucceeded()
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

  noteCaptureSucceeded()
  return { ok: true, downloadId, filename }
}
