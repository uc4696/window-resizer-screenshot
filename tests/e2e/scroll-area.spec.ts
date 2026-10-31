import { expect, test, type Page } from "./fixtures"
import {
  getDownloadRequests,
  readPngSize,
  recordDownloadRequests,
  waitForCaptureBadge,
  waitForCompletedDownload
} from "./helpers"
import {
  INNER_SCROLL_CONTENT_HEIGHT,
  INNER_SCROLL_FOOTER,
  INNER_SCROLL_TOP,
  LIST_CONTENT_HEIGHT,
  LIST_WIDTH
} from "./test-server"

const DOWNLOAD_FULL = "Download screenshot of full page"
const PICK = "Choose a scrollable area to capture"

/** 対象ページの表示サイズと DPR。 */
async function viewportOf(target: Page) {
  return target.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio
  }))
}

/** 画像の高さが期待値（CSS px × DPR）とタイル結合の丸め程度の誤差で一致することを確かめる。 */
function expectHeight(actual: number, cssHeight: number, dpr: number) {
  expect(Math.abs(actual - cssHeight * dpr)).toBeLessThanOrEqual(4 * dpr)
}

test.describe("スクロール範囲の撮影（自動判定）", () => {
  test("ページ自体がスクロールせず主要な範囲がスクロールするとき、ページ全体はその範囲の中身だけを最後まで撮り、元のスクロール位置に戻す", async ({
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
    const viewport = await viewportOf(target)
    const mainWidth = await target.evaluate(
      () => document.querySelector<HTMLElement>(".main")!.clientWidth
    )
    expect(INNER_SCROLL_CONTENT_HEIGHT).toBeGreaterThan(viewport.h)

    const popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    // トップバー・サイドバーは含めず、範囲の幅 × 中身の高さになる
    const size = readPngSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBe(Math.round(mainWidth * viewport.dpr))
    expectHeight(size.height, INNER_SCROLL_CONTENT_HEIGHT, viewport.dpr)

    // 撮影後は元のスクロール位置に戻り、目印の属性も残らない
    const after = await target.evaluate(() => ({
      scrollTop: document.querySelector<HTMLElement>(".main")!.scrollTop,
      marked: document.querySelectorAll("[data-wvr-scroll-target]").length
    }))
    expect(after).toEqual({ scrollTop: 500, marked: 0 })
  })

  test("設定で「外枠と範囲の下の部分も含める」を有効にすると、トップバー + 範囲の中身 + フッターの高さで撮る", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#scrollAreaIncludeFrame").check()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    const target = await openTarget("/inner-scroll-footer")
    const viewport = await viewportOf(target)
    const popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    const size = readPngSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))
    expectHeight(
      size.height,
      INNER_SCROLL_TOP + INNER_SCROLL_CONTENT_HEIGHT + INNER_SCROLL_FOOTER,
      viewport.dpr
    )
  })

  test("主要でない小さなスクロール範囲しかないページでは、伸ばさずに表示部分の1画面だけを撮る", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/small-scroll")
    const viewport = await viewportOf(target)
    const popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: DOWNLOAD_FULL }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")

    const size = readPngSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBe(Math.round(viewport.w * viewport.dpr))
    expectHeight(size.height, viewport.h, viewport.dpr)
  })
})

test.describe("範囲を選んで撮影", () => {
  /** popup の［選択］を押して範囲選択を開始し、一覧（.list）の中央をクリックしてメニューを出す。 */
  async function pickList(target: Page, popup: Page) {
    await popup.getByRole("button", { name: PICK }).click()
    await popup.waitForEvent("close", { timeout: 5_000 })
    await target.bringToFront()
    await expect(
      target.getByText("Click the area to capture (Esc to cancel)")
    ).toBeVisible()
    const box = (await target.locator(".list").boundingBox())!
    await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await target.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(
      target.getByRole("button", { name: "Download", exact: true })
    ).toBeVisible()
  }

  test("選べる範囲がないページでは［選択］ボタンが無効になる", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const button = popup.getByRole("button", { name: PICK })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute(
      "title",
      "There is no scrollable area to choose on this page"
    )
  })

  test("一覧を選んでダウンロードすると、一覧の中身だけの画像になり、選択 UI と目印は残らない", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/picker")
    const viewport = await viewportOf(target)
    const listWidth = await target.evaluate(
      () => document.querySelector<HTMLElement>(".list")!.clientWidth
    )
    expect(listWidth).toBeLessThanOrEqual(LIST_WIDTH)
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await pickList(target, popup)
    await target.getByRole("button", { name: "Download", exact: true }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    const size = readPngSize(await waitForCompletedDownload(serviceWorker))
    expect(size.width).toBe(Math.round(listWidth * viewport.dpr))
    expectHeight(size.height, LIST_CONTENT_HEIGHT, viewport.dpr)
    expect(await getDownloadRequests(serviceWorker)).toHaveLength(1)

    // 選択 UI のクリックはページに届かない（リンクに遷移していない）
    expect(new URL(target.url()).hash).toBe("")
    await expect(
      target.getByText("Click the area to capture (Esc to cancel)")
    ).toHaveCount(0)
    expect(
      await target.evaluate(
        () => document.querySelectorAll("[data-wvr-scroll-target]").length
      )
    ).toBe(0)
  })

  test("一覧を選んでコピーすると、一覧の中身の PNG がクリップボードに入る（ダウンロードはされない）", async ({
    context,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const target = await openTarget("/picker")
    const viewport = await viewportOf(target)
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await pickList(target, popup)
    await target.getByRole("button", { name: "Copy", exact: true }).click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target, 60_000)).toBe("OK")

    const clip = await target.evaluate(async () => {
      const items = await navigator.clipboard.read()
      const bitmap = await createImageBitmap(await items[0].getType("image/png"))
      return { width: bitmap.width, height: bitmap.height }
    })
    expectHeight(clip.height, LIST_CONTENT_HEIGHT, viewport.dpr)
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })

  test("Esc で範囲選択を中止すると、撮影せずに選択 UI が消える", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/picker")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await pickList(target, popup)
    await target.keyboard.press("Escape")
    await expect(
      target.getByText("Click the area to capture (Esc to cancel)")
    ).toHaveCount(0)
    await expect(
      target.getByRole("button", { name: "Download", exact: true })
    ).toHaveCount(0)
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })
})
