import { expect, test } from "./fixtures"
import {
  getDownloadRequests,
  readJpegSize,
  readPngSize,
  readWebpSize,
  recordDownloadRequests,
  selectImageFormat,
  waitForCaptureBadge,
  waitForCompletedDownload
} from "./helpers"
import {
  INNER_SCROLL_CONTENT_HEIGHT,
  INNER_SCROLL_TOP,
  LONG_PAGE_TOTAL_HEIGHT
} from "./test-server"

const DOWNLOAD_VISIBLE = "Download screenshot of visible area"
const DOWNLOAD_FULL = "Download screenshot of full page"

test.describe("スクリーンショット（正常系）", () => {
  test("表示範囲の撮影（既定）: popup が閉じ、Captures フォルダに screenshot_*.png が保存され、バッジが OK になる", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")

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
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    const filePath = await waitForCompletedDownload(serviceWorker)
    const size = readPngSize(filePath)
    // 画像の高さはページ全体の高さ × DPR（誤差はタイル結合の丸め程度を許容）
    const expectedHeight = LONG_PAGE_TOTAL_HEIGHT * viewport.dpr
    expect(Math.abs(size.height - expectedHeight)).toBeLessThanOrEqual(4 * viewport.dpr)
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))
  })

  test("フルページ撮影: ページ自体がスクロールせず内側の要素がスクロールするレイアウトでも、中身の最後まで撮影し、元のスクロール位置に戻す", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/inner-scroll")
    // 途中までスクロールした状態から撮影する（smooth 指定のページなので instant で即時に動かす）
    await target.evaluate(() => {
      document
        .querySelector<HTMLElement>(".main")!
        .scrollTo({ top: 500, behavior: "instant" })
    })
    const viewport = await target.evaluate(() => ({
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
      pageScrollHeight: document.documentElement.scrollHeight
    }))
    // ページ自体はスクロールしないこと、内側の中身がビューポートより長いことが前提
    expect(viewport.pageScrollHeight).toBeLessThanOrEqual(viewport.h)
    expect(INNER_SCROLL_CONTENT_HEIGHT).toBeGreaterThan(viewport.h)

    const popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    const size = readPngSize(await waitForCompletedDownload(serviceWorker))
    // 画像の高さは「トップバー + 内側の中身の高さ」× DPR
    const expectedHeight = (INNER_SCROLL_TOP + INNER_SCROLL_CONTENT_HEIGHT) * viewport.dpr
    expect(Math.abs(size.height - expectedHeight)).toBeLessThanOrEqual(4 * viewport.dpr)
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))

    // 撮影後は元のスクロール位置に戻り、目印の属性も残らない
    const after = await target.evaluate(() => ({
      scrollTop: document.querySelector<HTMLElement>(".main")!.scrollTop,
      marked: document.querySelectorAll("[data-wvr-scroll-target]").length
    }))
    expect(after).toEqual({ scrollTop: 500, marked: 0 })
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
    let popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")
    const visibleSize = readWebpSize(await waitForCompletedDownload(serviceWorker))
    expect(visibleSize.width).toBeGreaterThan(0)

    // 保存すると popup が閉じるので、開き直してフルページを撮る
    popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

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
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: DOWNLOAD_VISIBLE }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")
    expect((await getDownloadRequests(serviceWorker))[0]).toMatch(
      /^Captures\/screenshot_\d{8}_\d{6}\.jpg$/
    )
    const size = readJpegSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBeGreaterThan(0)
  })
})
