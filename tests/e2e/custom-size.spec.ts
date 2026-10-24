import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { getViewportSize, getWindowSize, waitForFinalStatus } from "./helpers"

/** 「カスタムサイズ設定」アコーディオンを開く。 */
async function openCustomForm(popup: Page) {
  await popup.getByRole("button", { name: "▼ Custom size settings" }).click()
  await expect(popup.getByText("Add custom size")).toBeVisible()
}

async function fillCustomForm(
  popup: Page,
  values: {
    name?: string
    width: string
    height: string
    offsetW?: string
    offsetH?: string
  }
) {
  if (values.name !== undefined)
    await popup.getByPlaceholder("Name (optional)").fill(values.name)
  await popup.getByPlaceholder("Width", { exact: true }).fill(values.width)
  await popup.getByPlaceholder("Height", { exact: true }).fill(values.height)
  if (values.offsetW !== undefined) {
    await popup.getByPlaceholder("Width offset (e.g. 14)").fill(values.offsetW)
  }
  if (values.offsetH !== undefined) {
    await popup.getByPlaceholder("Height offset (e.g. 7)").fill(values.offsetH)
  }
}

const addButton = (popup: Page) => popup.getByRole("button", { name: "Add", exact: true })
const customRow = (popup: Page, name: string) =>
  popup.locator("button.custom-size-apply", { hasText: name })

test.describe("カスタムサイズ（正常系）", () => {
  test("追加 → 一覧に表示 → 適用でビューポートが変わる → 削除できる", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await openCustomForm(popup)
    await fillCustomForm(popup, {
      name: "My size",
      width: "700",
      height: "500"
    })
    await addButton(popup).click()
    await expect(customRow(popup, "My size")).toBeVisible()

    await customRow(popup, "My size").click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 700 x 500.")
    await target.bringToFront()
    await expect.poll(() => getViewportSize(target)).toEqual({ width: 700, height: 500 })

    await popup.bringToFront()
    await popup.getByRole("button", { name: "Delete" }).click()
    await expect(customRow(popup, "My size")).toHaveCount(0)
  })

  test("名前を省略すると「幅x高さ」が名称になる", async ({ openTarget, openPopup }) => {
    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await openCustomForm(popup)
    await fillCustomForm(popup, { width: "640", height: "360" })
    await addButton(popup).click()
    await expect(customRow(popup, "640x360")).toBeVisible()
  })

  test("編集: 既存のカスタムサイズを更新できる", async ({ openTarget, openPopup }) => {
    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await openCustomForm(popup)
    await fillCustomForm(popup, { name: "Before", width: "700", height: "500" })
    await addButton(popup).click()

    await popup.getByRole("button", { name: "Edit" }).click()
    await expect(popup.getByText("Edit custom size")).toBeVisible()
    await popup.getByPlaceholder("Name (optional)").fill("After")
    await popup.getByRole("button", { name: "Update" }).click()

    await expect(customRow(popup, "After")).toBeVisible()
    await expect(customRow(popup, "Before")).toHaveCount(0)
  })

  test("再読み込みしてもカスタムサイズが保持される（storage 永続化）", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await openCustomForm(popup)
    await fillCustomForm(popup, {
      name: "Persisted",
      width: "720",
      height: "480"
    })
    await addButton(popup).click()
    await expect(customRow(popup, "Persisted")).toBeVisible()

    await popup.reload()
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await expect(customRow(popup, "Persisted")).toBeVisible()
  })

  test("ウィンドウ基準: オフセットがウィンドウサイズに加算される", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await openCustomForm(popup)
    await fillCustomForm(popup, {
      name: "With offset",
      width: "800",
      height: "600",
      offsetW: "20",
      offsetH: "10"
    })
    await addButton(popup).click()

    await customRow(popup, "With offset").click()
    await waitForFinalStatus(popup)
    await expect
      .poll(() => getWindowSize(serviceWorker, target))
      .toEqual({ width: 820, height: 610 })
  })
})
