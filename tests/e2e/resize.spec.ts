import { expect, test } from "./fixtures"
import {
  getViewportSize,
  getWindowSize,
  presetButton,
  waitForFinalStatus
} from "./helpers"

test.describe("リサイズ機能（正常系）", () => {
  test("拡張機能が読み込まれ、Service Worker が起動する", async ({ serviceWorker }) => {
    expect(serviceWorker.url()).toMatch(
      /^chrome-extension:\/\/.+\/static\/background\/index\.js/
    )
    const manifest = await serviceWorker.evaluate(() => chrome.runtime.getManifest())
    expect(manifest.manifest_version).toBe(3)
  })

  test("popup に全プリセット（16:9 と 4:3 の各4種）が表示される", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    await expect(popup.locator("button.preset-button")).toHaveCount(8)
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
      [2560, 1440],
      [3840, 2160],
      [640, 480],
      [800, 600],
      [1024, 768],
      [1600, 1200]
    ]) {
      await expect(presetButton(popup, w, h)).toBeVisible()
    }
  })

  test("ビューポート基準: プリセット(XGA)で対象ページのビューポートが 1024x768 になる", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await presetButton(popup, 1024, 768).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 1024 x 768.")

    await target.bringToFront()
    await expect.poll(() => getViewportSize(target)).toEqual({ width: 1024, height: 768 })
  })

  test("ウィンドウ基準: プリセット(SVGA)でウィンドウ全体が 800x600 になる", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 800 x 600.")

    await expect
      .poll(() => getWindowSize(serviceWorker, target))
      .toEqual({ width: 800, height: 600 })
  })

  test("popup の現在サイズ表示がリサイズ後の値に更新される", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    // ウィンドウ基準で適用し、1行目（ウィンドウ）の表示が更新されることを確認する
    // （ビューポート行は popup が別タブで対象タブが非表示になるため、この検証方法では対象外）
    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    await waitForFinalStatus(popup)

    await expect(popup.locator(".size-value").first()).toHaveText("800 x 600")
  })
})
