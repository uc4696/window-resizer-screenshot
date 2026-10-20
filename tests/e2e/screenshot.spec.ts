import { expect, test } from "./fixtures"
import {
  getDownloadRequests,
  readJpegSize,
  readPngSize,
  readWebpSize,
  recordDownloadRequests,
  selectImageFormat,
  waitForCompletedDownload,
  waitForFinalStatus
} from "./helpers"
import { LONG_PAGE_TOTAL_HEIGHT } from "./test-server"

const DOWNLOAD_VISIBLE = "Download screenshot of visible area"
const DOWNLOAD_FULL = "Download screenshot of full page"

test.describe("スクリーンショット（正常系）", () => {
  test("表示範囲の撮影（既定）: Captures フォルダに screenshot_*.png が保存され、有効なPNGである", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    const status = await waitForFinalStatus(popup)
    expect(status).toMatch(/^Saved: screenshot_\d{8}_\d{6}\.png$/)

    // 保存先の指定は「Captures/screenshot_YYYYMMDD_HHMMSS.png」
    const requests = await getDownloadRequests(serviceWorker)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatch(/^Captures\/screenshot_\d{8}_\d{6}\.png$/)

    const filePath = await waitForCompletedDownload(serviceWorker)
    const size = readPngSize(filePath)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })

  test("フルページ撮影（既定）: 縦長ページ全体の高さのPNGで保存される", async ({
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

    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    const status = await waitForFinalStatus(popup, 60_000)
    expect(status).toMatch(/^Saved: .*\.png$/)

    const filePath = await waitForCompletedDownload(serviceWorker)
    const size = readPngSize(filePath)
    // 画像の高さはページ全体の高さ × DPR（誤差はタイル結合の丸め程度を許容）
    const expectedHeight = LONG_PAGE_TOTAL_HEIGHT * viewport.dpr
    expect(Math.abs(size.height - expectedHeight)).toBeLessThanOrEqual(
      4 * viewport.dpr
    )
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))
  })

  test("設定で WebP を選ぶと、表示範囲・フルページとも .webp の有効なWebPで保存される", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await selectImageFormat(options, "WebP")

    const target = await openTarget("/long")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    expect(await waitForFinalStatus(popup)).toMatch(/\.webp$/)
    const visibleSize = readWebpSize(await waitForCompletedDownload(serviceWorker))
    expect(visibleSize.width).toBeGreaterThan(0)

    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    await expect(popup.locator(".status-text")).toHaveText(/^Saved: .*\.webp$/, {
      timeout: 60_000
    })

    const requests = await getDownloadRequests(serviceWorker)
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(request).toMatch(/^Captures\/screenshot_\d{8}_\d{6}\.webp$/)
    }
  })

  test("設定で JPEG を選ぶと、.jpg の有効なJPEGで保存される", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await selectImageFormat(options, "JPEG")

    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    expect(await waitForFinalStatus(popup)).toMatch(
      /^Saved: screenshot_\d{8}_\d{6}\.jpg$/
    )
    const size = readJpegSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBeGreaterThan(0)
  })
})
