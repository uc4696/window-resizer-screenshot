import { expect, test, type Page } from "./fixtures"
import {
  getViewportSize,
  getWindowSize,
  presetButton,
  waitForFinalStatus
} from "./helpers"

import type { Worker } from "@playwright/test"

/** 対象ページのタブの拡大率を設定し、そのタブIDを返す。 */
async function setTargetZoom(serviceWorker: Worker, target: Page, zoom: number) {
  await target.bringToFront()
  return serviceWorker.evaluate(async (z) => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    await chrome.tabs.setZoom(tab.id as number, z)
    return tab.id as number
  }, zoom)
}

function getZoom(serviceWorker: Worker, tabId: number) {
  return serviceWorker.evaluate((id) => chrome.tabs.getZoom(id), tabId)
}

test.describe("拡大縮小されたページのリサイズ", () => {
  test("拡大率が100%以外なら確認を出し、許可すると100%に戻してからリサイズする", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const tabId = await setTargetZoom(serviceWorker, target, 1.5)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await presetButton(popup, 1024, 768).click()

    const dialog = popup.getByRole("dialog")
    await expect(dialog).toContainText("150%")
    await dialog.getByRole("button", { name: "Reset to 100% and resize" }).click()
    await expect(dialog).toHaveCount(0)
    expect(await waitForFinalStatus(popup)).toBe("Resized to 1024 x 768.")

    expect(await getZoom(serviceWorker, tabId)).toBe(1)
    await target.bringToFront()
    await expect.poll(() => getViewportSize(target)).toEqual({ width: 1024, height: 768 })
  })

  test("確認でキャンセルすると、拡大率もサイズも変えない", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const tabId = await setTargetZoom(serviceWorker, target, 1.25)
    const before = await getWindowSize(serviceWorker, target)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    const dialog = popup.getByRole("dialog")
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toHaveCount(0)

    expect(await getZoom(serviceWorker, tabId)).toBe(1.25)
    await expect(popup.locator(".status-text")).toHaveText("")
    expect(await getWindowSize(serviceWorker, target)).toEqual(before)
  })

  test("拡大率が100%なら確認を出さずにリサイズする", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 800 x 600.")
    await expect(popup.getByRole("dialog")).toHaveCount(0)
  })

  test("設定で確認をオフにすると、確認なしで100%に戻してからリサイズする", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    const checkbox = options.locator("#zoomResetConfirm")
    // 既定は確認あり
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await options.close()

    const target = await openTarget("/")
    const tabId = await setTargetZoom(serviceWorker, target, 0.8)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await presetButton(popup, 1024, 768).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 1024 x 768.")
    await expect(popup.getByRole("dialog")).toHaveCount(0)

    expect(await getZoom(serviceWorker, tabId)).toBe(1)
    await target.bringToFront()
    await expect.poll(() => getViewportSize(target)).toEqual({ width: 1024, height: 768 })
  })
})
