import { expect, test } from "./fixtures"
import {
  getDownloadRequests,
  readJpegSize,
  recordDownloadRequests,
  waitForCompletedDownload,
  waitForFinalStatus
} from "./helpers"
import { LONG_PAGE_TOTAL_HEIGHT } from "./test-server"

test.describe("スクリーンショット（正常系）", () => {
  test("表示範囲の撮影: Captures フォルダに screenshot_*.jpg が保存され、有効なJPEGである", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: "Capture visible area" }).click()
    const status = await waitForFinalStatus(popup)
    expect(status).toMatch(/^Saved: screenshot_\d{8}_\d{6}\.jpg$/)

    // 保存先の指定は「Captures/screenshot_YYYYMMDD_HHMMSS.jpg」
    const requests = await getDownloadRequests(serviceWorker)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatch(/^Captures\/screenshot_\d{8}_\d{6}\.jpg$/)

    const filePath = await waitForCompletedDownload(serviceWorker)
    const size = readJpegSize(filePath)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })

  test("フルページ撮影: 縦長ページ全体の高さで保存される", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/long")
    const popup = await openPopup(target)
    await target.bringToFront()

    const viewport = await target.evaluate(() => ({
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio
    }))
    // 縦長ページがビューポートに収まっていないこと（複数タイルの撮影になること）が前提
    expect(LONG_PAGE_TOTAL_HEIGHT).toBeGreaterThan(viewport.h)

    await popup.getByRole("button", { name: "Capture full page" }).click()
    const status = await waitForFinalStatus(popup, 60_000)
    expect(status).toMatch(/^Saved: /)

    const filePath = await waitForCompletedDownload(serviceWorker)
    const size = readJpegSize(filePath)
    // 画像の高さはページ全体の高さ × DPR（誤差はタイル結合の丸め程度を許容）
    const expectedHeight = LONG_PAGE_TOTAL_HEIGHT * viewport.dpr
    expect(Math.abs(size.height - expectedHeight)).toBeLessThanOrEqual(
      4 * viewport.dpr
    )
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))
  })
})
