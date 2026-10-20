import { expect, test } from "./fixtures"
import {
  getDownloadRequests,
  presetButton,
  recordDownloadRequests,
  waitForFinalStatus
} from "./helpers"

test.describe("設定画面（正常系）", () => {
  test("保存先フォルダ名を変更して保存すると、撮影時の保存先に反映される", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#captureDirName").fill("E2ECaptures")
    await options
      .getByRole("button", { name: "Save", exact: true })
      .first()
      .click()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    const target = await openTarget("/")
    const popup = await openPopup(target)
    await target.bringToFront()
    await recordDownloadRequests(serviceWorker)
    await popup.getByRole("button", { name: "Download screenshot of visible area" }).click()
    await waitForFinalStatus(popup)

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

  test("プリセットのオフセットを保存すると popup のプリセットにバッジが表示される", async ({
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
    await windowRow.getByRole("button", { name: "Save" }).click()
    await expect(windowRow.getByRole("button", { name: "Clear" })).toBeVisible()

    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Window-based" }).click()
    await expect(
      presetButton(popup, 800, 600).locator(".preset-offset-badge")
    ).toBeVisible()
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

  test("画像形式の変更は、設定の初期化で PNG に戻る", async ({ context, extensionId }) => {
    const options = await context.newPage()
    options.on("dialog", (dialog) => dialog.accept())
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.getByRole("radio", { name: "JPEG", exact: true }).check()
    await expect(options.getByText("Settings saved.")).toBeVisible()

    await options.getByRole("button", { name: "Reset settings" }).click()
    await expect(options.getByText("Settings have been reset.")).toBeVisible()
    await expect(options.getByRole("radio", { name: "PNG", exact: true })).toBeChecked()
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
