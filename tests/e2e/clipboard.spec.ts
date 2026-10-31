import { expect, test, type Page } from "./fixtures"
import { getDownloadRequests, recordDownloadRequests, selectImageFormat } from "./helpers"

const COPY_VISIBLE = "Copy screenshot of visible area to clipboard"
const COPY_FULL = "Copy screenshot of full page to clipboard"

/**
 * クリップボードの中身を読む。コピー後は popup が閉じるため、対象ページ側から読む
 * （クリップボードの読み取りにはフォーカスが必要なので前面にしてから読む）。
 */
async function readClipboard(target: Page) {
  await target.bringToFront()
  return target.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const types = [...items[0].types]
    const blob = await items[0].getType("image/png")
    const bitmap = await createImageBitmap(blob)
    return {
      types,
      mime: blob.type,
      size: blob.size,
      width: bitmap.width,
      height: bitmap.height
    }
  })
}

test.describe("クリップボードへのコピー", () => {
  test.beforeEach(async ({ context }) => {
    // 検証のためクリップボードの読み書きを許可する
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  })

  test("表示範囲のコピー: PNG画像がクリップボードに入り、check アイコンを見せてから popup が閉じる（ダウンロードはされない）", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    const button = popup.getByRole("button", { name: COPY_VISIBLE })
    const normalIcon = await button.innerHTML()
    await button.click()

    await expect(popup.locator(".status-text")).toHaveText("Copied to clipboard.")
    await expect(button).toHaveClass(/copied/)
    // check アイコンに切り替わっている（元のコピーアイコンとは異なる SVG になる）
    // ※ SVG 内の class は Icon.tsx で除去されるため、class 名には依存しない
    expect(await button.innerHTML()).not.toBe(normalIcon)

    // 少し間を置いて popup が閉じる
    await popup.waitForEvent("close", { timeout: 5_000 })

    const clip = await readClipboard(target)
    expect(clip.types).toContain("image/png")
    expect(clip.mime).toBe("image/png")
    expect(clip.size).toBeGreaterThan(0)

    // コピー操作ではファイルをダウンロードしない
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })

  test("保存形式が WebP でも、コピーは常にPNGになる", async ({
    context,
    extensionId,
    openTarget,
    openPopup
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await selectImageFormat(options, "WebP")

    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await popup.getByRole("button", { name: COPY_VISIBLE }).click()
    await expect(popup.locator(".status-text")).toHaveText("Copied to clipboard.")
    await popup.waitForEvent("close", { timeout: 5_000 })

    expect((await readClipboard(target)).types).toEqual(["image/png"])
  })

  test("ページ全体のコピー: 縦長ページでもPNGがクリップボードに入り、ダウンロードはされない", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/long")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)

    await popup.getByRole("button", { name: COPY_FULL }).click()
    await expect(popup.locator(".status-text")).toHaveText("Copied to clipboard.", {
      timeout: 60_000
    })
    await popup.waitForEvent("close", { timeout: 5_000 })

    const clip = await readClipboard(target)
    expect(clip.height).toBeGreaterThan(clip.width / 10)

    // コピー操作ではファイルをダウンロードしない
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })
})
