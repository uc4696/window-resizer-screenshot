import { buildDownloadPath, buildScreenshotFilename } from "~lib/filename"
import { initI18n, t } from "~lib/i18n"
import type { CaptureRequest, CaptureResponse } from "~lib/messages"
import { captureFullPage, captureVisibleTab } from "~lib/screenshot"
import { getSettings } from "~lib/storage"

chrome.runtime.onMessage.addListener(
  (message: CaptureRequest, sender, sendResponse: (response: CaptureResponse) => void) => {
    if (message?.type !== "capture-screenshot") return

    handleCapture(message)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message ?? String(error) })
      )

    // 非同期処理のため true を返す
    return true
  }
)

async function handleCapture(message: CaptureRequest): Promise<CaptureResponse> {
  // service worker は随時停止・再起動されるため、処理ごとに最新の言語設定を反映する
  await initI18n()

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || tab.windowId === undefined) {
    return { ok: false, error: t("errNoActiveTab") }
  }

  const dataUrl =
    message.mode === "full-page"
      ? await captureFullPage(tab.id, tab.windowId)
      : await captureVisibleTab(tab.windowId)

  const settings = await getSettings()
  const filename = buildScreenshotFilename()
  const path = buildDownloadPath(settings.captureDirName, filename)

  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: path,
    saveAs: false,
    conflictAction: "uniquify"
  })

  return { ok: true, downloadId, filename }
}
