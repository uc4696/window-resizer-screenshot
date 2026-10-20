import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

async function openForm(popup: Page, mode: "Window-based" | "Viewport-based") {
  await popup.getByRole("button", { name: mode }).click()
  await popup.getByRole("button", { name: "▼ Custom size settings" }).click()
  await expect(popup.getByText("Add custom size")).toBeVisible()
}

const cases: {
  title: string
  width: string
  height: string
  message: RegExp
}[] = [
  {
    title: "最小値(200px)未満はエラー",
    width: "100",
    height: "500",
    message: /at least 200px/
  },
  {
    title: "小数はエラー",
    width: "700.5",
    height: "500",
    message: /must be integers/
  },
  {
    title: "ディスプレイ解像度超過はエラー",
    width: "99999",
    height: "500",
    message: /must not exceed the current display resolution/
  }
]

test.describe("カスタムサイズ（入力チェック）", () => {
  for (const c of cases) {
    test(c.title, async ({ openTarget, openPopup }) => {
      const popup = await openPopup(await openTarget("/"))
      await openForm(popup, "Viewport-based")
      await popup.getByPlaceholder("Width", { exact: true }).fill(c.width)
      await popup.getByPlaceholder("Height", { exact: true }).fill(c.height)
      await popup.getByRole("button", { name: "Add", exact: true }).click()
      await expect(popup.locator(".error-text")).toHaveText(c.message)
      await expect(popup.locator("button.custom-size-apply")).toHaveCount(0)
    })
  }

  test("オフセットが範囲(±500px)外ならエラー", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    await openForm(popup, "Window-based")
    await popup.getByPlaceholder("Width", { exact: true }).fill("800")
    await popup.getByPlaceholder("Height", { exact: true }).fill("600")
    await popup.getByPlaceholder("Width offset (e.g. 14)").fill("501")
    await popup.getByRole("button", { name: "Add", exact: true }).click()
    await expect(popup.locator(".error-text")).toHaveText(
      /between -500px and 500px/
    )
  })

  test("制限ページ(chrome://)ではビューポート基準のリサイズがエラーになる", async ({
    context,
    openPopup
  }) => {
    const restricted = await context.newPage()
    await restricted.goto("chrome://version")
    const popup = await openPopup(restricted)
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await popup.locator('button.preset-button[title="1024 x 768"]').click()
    await expect(popup.locator(".status-text")).toHaveText(
      /^Error: Due to Chrome restrictions/
    )
  })
})
