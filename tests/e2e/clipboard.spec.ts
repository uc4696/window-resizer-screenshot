import { expect, test } from "./fixtures"
import { selectImageFormat } from "./helpers"

const COPY_VISIBLE = "Copy screenshot of visible area to clipboard"
const COPY_FULL = "Copy screenshot of full page to clipboard"

test.describe("クリップボードへのコピー", () => {
  test.beforeEach(async ({ context }) => {
    // popup ページからのクリップボード読み書きを許可する（検証用）
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  })

  test("表示範囲のコピー: PNG画像がクリップボードに入り、アイコンが1.5秒だけ check に切り替わる", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()

    const button = popup.getByRole("button", { name: COPY_VISIBLE })
    const normalIcon = await button.innerHTML()
    await button.click()

    await expect(popup.locator(".status-text")).toHaveText("Copied to clipboard.")
    await expect(button).toHaveClass(/copied/)
    // check アイコンに切り替わっている（元のコピーアイコンとは異なる）
    expect(await button.innerHTML()).not.toBe(normalIcon)
    expect(await button.innerHTML()).toContain("icon-tabler-check")

    // 1.5秒後に元のアイコンへ戻る
    await expect(button).not.toHaveClass(/copied/, { timeout: 5_000 })
    expect(await button.innerHTML()).toBe(normalIcon)

    const type = await popup.evaluate(async () => {
      const items = await navigator.clipboard.read()
      const blob = await items[0].getType("image/png")
      return { mime: blob.type, size: blob.size, types: items[0].types }
    })
    expect(type.types).toContain("image/png")
    expect(type.mime).toBe("image/png")
    expect(type.size).toBeGreaterThan(0)
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

    const types = await popup.evaluate(async () => {
      const items = await navigator.clipboard.read()
      return items[0].types
    })
    expect(types).toEqual(["image/png"])
  })

  test("ページ全体のコピー: 縦長ページでもPNGがクリップボードに入る", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/long")
    const popup = await openPopup(target)
    await target.bringToFront()

    await popup.getByRole("button", { name: COPY_FULL }).click()
    await expect(popup.locator(".status-text")).toHaveText("Copied to clipboard.", {
      timeout: 60_000
    })

    const size = await popup.evaluate(async () => {
      const items = await navigator.clipboard.read()
      const bitmap = await createImageBitmap(await items[0].getType("image/png"))
      return { width: bitmap.width, height: bitmap.height }
    })
    expect(size.height).toBeGreaterThan(size.width / 10)
  })
})
