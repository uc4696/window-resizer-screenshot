import type { Worker } from "@playwright/test"

import { expect, test, type Page } from "./fixtures"
import { getViewportSize, presetButton, waitForFinalStatus } from "./helpers"

/**
 * xvfb の画面は 1920x1080（WM がないので作業領域も同じ）。Windows で動かすときは大きさが違うので、
 * 位置の期待値は実際の作業領域から求める。
 */
function getWorkArea(target: Page) {
  return target.evaluate(() => {
    const s = window.screen as Screen & { availLeft: number; availTop: number }
    return {
      left: s.availLeft,
      top: s.availTop,
      width: s.availWidth,
      height: s.availHeight
    }
  })
}

function getBounds(serviceWorker: Worker, target: Page) {
  return serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    const win = await chrome.windows.get(tab.windowId)
    return { left: win.left, top: win.top, width: win.width, height: win.height }
  }, target.url())
}

/** 対象のウィンドウを、作業領域の右下寄りへ小さくして置く。 */
async function moveToBottomRight(serviceWorker: Worker, target: Page) {
  const area = await getWorkArea(target)
  const bounds = {
    width: 600,
    height: 400,
    left: area.left + area.width - 620,
    top: area.top + area.height - 420
  }
  await serviceWorker.evaluate(
    async ({ url, bounds }) => {
      const [tab] = await chrome.tabs.query({ url })
      await chrome.windows.update(tab.windowId, { state: "normal", ...bounds })
    },
    { url: target.url(), bounds }
  )
  return area
}

test.describe("リサイズでウィンドウを画面内に収める", () => {
  test("ウィンドウ基準: 右下で大きくしても、サイズはそのままで画面内に収まる", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await moveToBottomRight(serviceWorker, target)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 1280, 720).click()
    expect(await waitForFinalStatus(popup)).toBe("Resized to 1280 x 720.")

    await expect
      .poll(() => getBounds(serviceWorker, target))
      .toEqual({
        left: area.left + area.width - 1280,
        top: area.top + area.height - 720,
        width: 1280,
        height: 720
      })
  })

  test("ビューポート基準: 指定のビューポートのまま、はみ出さない位置へ動く", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await moveToBottomRight(serviceWorker, target)
    const popup = await openPopup(target)

    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await presetButton(popup, 1024, 768).click()
    await waitForFinalStatus(popup)

    await target.bringToFront()
    await expect.poll(() => getViewportSize(target)).toEqual({ width: 1024, height: 768 })
    const bounds = await getBounds(serviceWorker, target)
    expect(bounds.left! + bounds.width!).toBeLessThanOrEqual(area.left + area.width)
    expect(bounds.top! + bounds.height!).toBeLessThanOrEqual(area.top + area.height)
  })

  test("ショートカット: タブに注入して読んだ作業領域で収める", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await moveToBottomRight(serviceWorker, target)
    await serviceWorker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      const { __commandListeners } = globalThis as unknown as {
        __commandListeners: ((name: string, tab: chrome.tabs.Tab) => void)[]
      }
      __commandListeners.forEach((listener) => listener("resize-preset-hd", tab))
    }, target.url())

    await expect
      .poll(() => getBounds(serviceWorker, target))
      .toEqual({
        left: area.left + area.width - 1280,
        top: area.top + area.height - 720,
        width: 1280,
        height: 720
      })
  })

  test("最大化中のウィンドウ: 通常の状態に戻して指定のサイズにし、画面内に収める", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await moveToBottomRight(serviceWorker, target)
    await serviceWorker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      await chrome.windows.update(tab.windowId, { state: "maximized" })
    }, target.url())
    const popup = await openPopup(target)
    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 1280, 720).click()
    await waitForFinalStatus(popup)

    await expect
      .poll(async () => {
        const { width, height } = await getBounds(serviceWorker, target)
        return { width, height }
      })
      .toEqual({ width: 1280, height: 720 })
    const bounds = await getBounds(serviceWorker, target)
    expect(bounds.left!).toBeGreaterThanOrEqual(area.left)
    expect(bounds.top!).toBeGreaterThanOrEqual(area.top)
    expect(bounds.left! + bounds.width!).toBeLessThanOrEqual(area.left + area.width)
    expect(bounds.top! + bounds.height!).toBeLessThanOrEqual(area.top + area.height)
  })

  test("ビューポート基準で画面と同じサイズ: ウィンドウは画面を超えるが、上端に合わせてタイトルバーを残す", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await moveToBottomRight(serviceWorker, target)
    const popup = await openPopup(target)
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await presetButton(popup, 1920, 1080).click()
    await waitForFinalStatus(popup)

    await expect
      .poll(async () => (await getBounds(serviceWorker, target)).top)
      .toBe(area.top)
    const bounds = await getBounds(serviceWorker, target)
    expect(bounds.left! + bounds.width!).toBe(area.left + area.width)
  })

  test("ディスプレイを超えるプリセットとカスタムサイズは押せず、理由をツールチップで知らせる", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const area = await getWorkArea(target)
    await serviceWorker.evaluate(
      ({ width }) =>
        chrome.storage.local.set({
          "custom-sizes": JSON.stringify([
            { id: "over", label: "Over", width: width + 1, height: 100, mode: "window" },
            { id: "fit", label: "Fit", width: 800, height: 600, mode: "window" }
          ])
        }),
      { width: area.width }
    )
    const popup = await openPopup(target)
    await popup.getByRole("button", { name: "Window-based" }).click()

    // xvfb の画面は 1920x1080。Windows で動かすときは画面の大きさで結果が変わる
    const size = await popup.evaluate(() => ({
      width: screen.width,
      height: screen.height
    }))
    const presets = await popup
      .locator("button.preset-button")
      .evaluateAll((els) =>
        els.map((el) => [
          el.getAttribute("data-size"),
          (el as HTMLButtonElement).disabled
        ])
      )
    for (const [dataSize, disabled] of presets as [string, boolean][]) {
      const [w, h] = dataSize.split("x").map(Number)
      expect(disabled).toBe(w > size.width || h > size.height)
    }
    await expect(presetButton(popup, 3840, 2160)).toHaveAttribute(
      "title",
      /Larger than this display/
    )
    await expect(popup.locator(".custom-size-apply", { hasText: "Over" })).toBeDisabled()
    await expect(popup.locator(".custom-size-apply", { hasText: "Fit" })).toBeEnabled()
  })

  test("収める設定をオフにすると、位置は変えない", async ({
    context,
    extensionId,
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.getByLabel("Move the window to keep it on screen").uncheck()
    await expect(options.getByText("Settings saved.")).toBeVisible()
    await options.close()

    const target = await openTarget("/")
    await serviceWorker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      await chrome.windows.update(tab.windowId, {
        state: "normal",
        left: 900,
        top: 100,
        width: 600,
        height: 400
      })
    }, target.url())
    const popup = await openPopup(target)
    await popup.getByRole("button", { name: "Window-based" }).click()
    await presetButton(popup, 800, 600).click()
    await waitForFinalStatus(popup)

    await expect
      .poll(() => getBounds(serviceWorker, target))
      .toEqual({
        left: 900,
        top: 100,
        width: 800,
        height: 600
      })
  })
})
