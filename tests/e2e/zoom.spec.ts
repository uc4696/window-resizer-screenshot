import { expect, test, type Page } from "./fixtures"
import { getWindowSize, presetButton, waitForFinalStatus } from "./helpers"

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

/** 描画エリアのサイズ（拡大率に左右されない）。 */
function getTabSize(serviceWorker: Worker, tabId: number) {
  return serviceWorker.evaluate(async (id) => {
    const tab = await chrome.tabs.get(id)
    return { width: tab.width, height: tab.height }
  }, tabId)
}

test.describe("拡大縮小されたページのリサイズ", () => {
  for (const zoom of [1.5, 0.8, 3]) {
    test(`拡大率 ${zoom * 100}%: 拡大率を変えず、確認も出さずにビューポートを指定のサイズにする`, async ({
      openTarget,
      openPopup,
      serviceWorker
    }) => {
      const target = await openTarget("/")
      const tabId = await setTargetZoom(serviceWorker, target, zoom)
      const popup = await openPopup(target)

      await popup.getByRole("button", { name: "Viewport-based" }).click()
      await presetButton(popup, 1024, 768).click()
      expect(await waitForFinalStatus(popup)).toBe("Resized to 1024 x 768.")
      await expect(popup.getByRole("dialog")).toHaveCount(0)
      await popup.close()

      // 裏のタブのサイズは更新されないので、前面に戻して確かめる（実際の popup では対象のタブが前面にある）
      await target.bringToFront()
      expect(await getZoom(serviceWorker, tabId)).toBe(zoom)
      await expect
        .poll(() => getTabSize(serviceWorker, tabId))
        .toEqual({ width: 1024, height: 768 })
      const reopened = await openPopup(target)
      await expect(reopened.locator(".size-value").nth(1)).toHaveText("1024×768")
    })
  }

  test("ウィンドウ基準でも拡大率を変えない", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const tabId = await setTargetZoom(serviceWorker, target, 1.25)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 800 x 600.")

    expect(await getZoom(serviceWorker, tabId)).toBe(1.25)
    expect(await getWindowSize(serviceWorker, target)).toEqual({
      width: 800,
      height: 600
    })
  })
})

test.describe("拡大中のページの今のサイズ", () => {
  for (const zoom of [1.5, 0.8, 3]) {
    test(`拡大率 ${zoom * 100}% でも、ビューポートは 1280x720 と表示・入力される`, async ({
      openTarget,
      openPopup,
      serviceWorker
    }) => {
      const target = await openTarget("/long")
      let popup = await openPopup(target)
      await popup.getByRole("button", { name: "Viewport-based" }).click()
      await presetButton(popup, 1280, 720).click()
      await waitForFinalStatus(popup)
      await popup.close()

      await setTargetZoom(serviceWorker, target, zoom)
      await target.waitForTimeout(300)
      popup = await openPopup(target)

      await expect(popup.locator(".size-value").nth(1)).toHaveText("1280×720")
      await expect(presetButton(popup, 1280, 720)).toHaveAttribute("aria-current", "true")
      await popup.getByRole("button", { name: "Add a custom size" }).click()
      await popup.getByRole("button", { name: "Use current size" }).click()
      await expect(popup.getByPlaceholder("Width", { exact: true })).toHaveValue("1280")
      await expect(popup.getByPlaceholder("Height", { exact: true })).toHaveValue("720")
    })
  }
})
