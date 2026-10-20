import { readFileSync } from "node:fs"

import { expect, type Page, type Worker } from "@playwright/test"

/** プリセットボタン（title が「幅 x 高さ」）を取得する。 */
export function presetButton(popup: Page, width: number, height: number) {
  return popup.locator(`button.preset-button[title="${width} x ${height}"]`)
}

/** ウィンドウ全体（外寸）のサイズを取得する。 */
export async function getWindowSize(
  serviceWorker: Worker,
  target: Page
): Promise<{ width: number; height: number }> {
  return serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    const win = await chrome.windows.get(tab.windowId)
    return { width: win.width ?? 0, height: win.height ?? 0 }
  }, target.url())
}

/** 対象ページのビューポート（innerWidth/innerHeight）を取得する。 */
export async function getViewportSize(
  target: Page
): Promise<{ width: number; height: number }> {
  return target.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
}

/** popup のステータス表示が成功/失敗のいずれかの最終状態になるまで待ち、その文言を返す。 */
export async function waitForFinalStatus(
  popup: Page,
  timeout = 30_000
): Promise<string> {
  const status = popup.locator(".status-text")
  await expect(status).toHaveText(/^(Saved|Resized|Error)/, { timeout })
  return status.innerText()
}

/**
 * 拡張機能が chrome.downloads.download に渡した filename（保存先の相対パス）を記録し始める。
 *
 * Playwright はダウンロードを横取りして一時フォルダへ保存するため、chrome.downloads が返す
 * 最終パスでは「Captures/screenshot_*.jpg」という保存先指定を検証できない。
 * そのため Service Worker 内で download() 呼び出しの引数を記録して検証する。
 * （撮影を行う前に呼び出すこと）
 */
export async function recordDownloadRequests(
  serviceWorker: Worker
): Promise<void> {
  await serviceWorker.evaluate(() => {
    const g = globalThis as unknown as { __downloadRequests?: string[] }
    g.__downloadRequests = []
    const original = chrome.downloads.download.bind(chrome.downloads)
    chrome.downloads.download = ((
      options: chrome.downloads.DownloadOptions
    ) => {
      g.__downloadRequests?.push(options.filename ?? "")
      return original(options)
    }) as typeof chrome.downloads.download
  })
}

/** recordDownloadRequests で記録した filename の一覧を返す。 */
export async function getDownloadRequests(
  serviceWorker: Worker
): Promise<string[]> {
  return serviceWorker.evaluate(
    () =>
      (globalThis as unknown as { __downloadRequests?: string[] })
        .__downloadRequests ?? []
  )
}

/** ダウンロードが完了するまで待ち、保存されたファイルのパスを返す。 */
export async function waitForCompletedDownload(
  serviceWorker: Worker
): Promise<string> {
  await expect
    .poll(
      async () =>
        serviceWorker.evaluate(async () => {
          const items = await chrome.downloads.search({ state: "complete" })
          return items.length
        }),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)
  return serviceWorker.evaluate(async () => {
    const items = await chrome.downloads.search({
      state: "complete",
      orderBy: ["-startTime"]
    })
    return items[0].filename
  })
}

/** JPEG ファイルのヘッダーを検証し、画像サイズ（px）を返す。JPEG でなければ例外を投げる。 */
export function readJpegSize(filePath: string): {
  width: number
  height: number
} {
  const buf = readFileSync(filePath)
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("JPEG ファイルではありません（SOI マーカーがありません）")
  }
  let offset = 2
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buf[offset + 1]
    // SOF0〜SOF15（DHT=C4, JPG=C8, DAC=CC を除く）にサイズ情報が入っている
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7)
      }
    }
    offset += 2 + buf.readUInt16BE(offset + 2)
  }
  throw new Error("JPEG のサイズ情報（SOF マーカー）が見つかりません")
}
