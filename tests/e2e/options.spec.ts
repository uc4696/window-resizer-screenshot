import { expect, test } from "./fixtures"
import {
  getDownloadRequests,
  presetButton,
  recordDownloadRequests,
  waitForCaptureBadge
} from "./helpers"

test.describe("設定画面（正常系）", () => {
  test("保存先フォルダ名は変更するだけで保存され、撮影時の保存先に反映される", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#captureDirName").fill("E2ECaptures")
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await expect(options.getByRole("button", { name: "Save" })).toHaveCount(0)

    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)
    await popup
      .getByRole("button", { name: "Download screenshot of visible area" })
      .click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")

    const requests = await getDownloadRequests(serviceWorker)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatch(/^E2ECaptures\/screenshot_\d{8}_\d{6}\.png$/)
  })

  test("言語を日本語に切り替えると、画面文言が日本語になり、設定が保持される", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#language").selectOption("ja")
    await expect(options.getByText("設定を保存しました。")).toBeVisible()
    await expect(options.locator("h1")).toContainText("設定")

    await options.reload()
    await expect(options.locator("#language")).toHaveValue("ja")
    await expect(options.locator("h1")).toContainText("設定")
  })

  test("プリセットのオフセットは入力欄を離れると保存され、popup に印が出て、空にすると消える", async ({
    context,
    extensionId,
    openTarget,
    openPopup
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    const item = options.locator(".offset-preset-item", {
      hasText: "SVGA (800×600)"
    })
    const windowRow = item.locator(".offset-preset-row").first()
    await windowRow.getByPlaceholder("Width offset").fill("14")
    await windowRow.getByPlaceholder("Height offset").fill("7")
    await windowRow.getByPlaceholder("Height offset").blur()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    const target = await openTarget("/")
    let popup = await openPopup(target)
    await popup.getByRole("button", { name: "Window-based" }).click()
    await expect(
      presetButton(popup, 800, 600).locator(".preset-offset-badge")
    ).toBeVisible()
    await expect(presetButton(popup, 800, 600)).toHaveAttribute("title", /\+14/)
    await popup.close()

    await windowRow.getByPlaceholder("Width offset").fill("")
    await windowRow.getByPlaceholder("Height offset").fill("")
    await windowRow.getByPlaceholder("Height offset").blur()
    popup = await openPopup(target)
    await popup.getByRole("button", { name: "Window-based" }).click()
    await expect(
      presetButton(popup, 800, 600).locator(".preset-offset-badge")
    ).toHaveCount(0)
  })

  test("ストレージ領域は選ぶだけで保存される", async ({ context, extensionId }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.getByRole("radio", { name: "sync", exact: true }).check()
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await options.reload()
    await expect(options.getByRole("radio", { name: "sync", exact: true })).toBeChecked()
  })

  test("テーマ: 既定はブラウザに合わせ、ライト・ダークを選ぶと popup にも反映され、初期化で戻る", async ({
    context,
    extensionId,
    openTarget,
    openPopup
  }) => {
    const options = await context.newPage()
    options.on("dialog", (dialog) => dialog.accept())
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    const theme = options.locator("#theme")
    await expect(theme).toHaveValue("auto")
    const colors = (page: typeof options) =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim()
      )

    await theme.selectOption("dark")
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await expect.poll(() => colors(options)).toBe("#111827")
    const target = await openTarget("/")
    let popup = await openPopup(target)
    await expect.poll(() => colors(popup)).toBe("#1f2937")
    await popup.close()

    await options.bringToFront()
    await theme.selectOption("light")
    await expect.poll(() => colors(options)).toMatch(/^#fff(fff)?$/)
    popup = await openPopup(target)
    await expect.poll(() => colors(popup)).toMatch(/^#fff(fff)?$/)
    await popup.close()

    await options.bringToFront()
    await options.getByRole("button", { name: "Reset settings" }).click()
    await expect(theme).toHaveValue("auto")
    await expect
      .poll(() => options.evaluate(() => document.documentElement.dataset.theme ?? null))
      .toBeNull()
  })

  test("画像形式の既定は PNG で、WebP に変更すると再読み込み後も保持される", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await expect(options.getByRole("radio", { name: "PNG", exact: true })).toBeChecked()

    await options.getByRole("radio", { name: "WebP", exact: true }).check()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    await options.reload()
    await expect(options.getByRole("radio", { name: "WebP", exact: true })).toBeChecked()
  })

  test("画像形式の変更は、設定の初期化で PNG に戻る", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    options.on("dialog", (dialog) => dialog.accept())
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.getByRole("radio", { name: "JPEG", exact: true }).check()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    await options.getByRole("button", { name: "Reset settings" }).click()
    await expect(options.getByText("Settings have been reset.")).toBeVisible()
    await expect(options.getByRole("radio", { name: "PNG", exact: true })).toBeChecked()
  })

  test("スクロール範囲の撮影設定（外枠を含める）は既定で無効、有効にすると再読み込み後も保持され、初期化で無効に戻る", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    options.on("dialog", (dialog) => dialog.accept())
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    const checkbox = options.locator("#scrollAreaIncludeFrame")
    await expect(checkbox).not.toBeChecked()

    await checkbox.check()
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await options.reload()
    await expect(checkbox).toBeChecked()

    await options.getByRole("button", { name: "Reset settings" }).click()
    await expect(options.getByText("Settings have been reset.")).toBeVisible()
    await expect(checkbox).not.toBeChecked()
  })

  test("設定画面の隅に Tabler Icons のクレジット（MIT License）が表示される", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await expect(options.locator(".options-credit")).toHaveText(
      "Icons: Tabler Icons (MIT License)"
    )
  })

  test("設定の初期化で、言語・カスタムサイズが既定値に戻る", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    options.on("dialog", (dialog) => dialog.accept())
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#language").selectOption("ja")
    await expect(options.getByText("設定を保存しました。")).toBeVisible()

    await options.getByRole("button", { name: "設定を初期化する" }).click()
    // 初期化により言語が「自動」（テストのブラウザ言語は英語）に戻るため、完了文言は英語になる
    await expect(options.getByText("Settings have been reset.")).toBeVisible()
    await expect(options.locator("#language")).toHaveValue("auto")
    await expect(options.locator("#captureDirName")).toHaveValue("Captures")
  })
})
