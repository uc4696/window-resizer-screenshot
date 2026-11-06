import { readFileSync } from "node:fs"

import { expect, test, type Page } from "./fixtures"
import { readPngSize, waitForFinalStatus } from "./helpers"

import type { Worker } from "@playwright/test"

const PAGE_HEIGHT = 2000

/** 背景は赤で、全面を青の本文で埋める。つなぎ目にすき間があると赤が出る。 */
const HTML = `<!doctype html><html><head><title>size</title><style>
html,body{margin:0;background:rgb(255,0,0)}
#c{height:${PAGE_HEIGHT}px;background:rgb(0,0,255)}
</style></head><body><div id="c"></div></body></html>`

/** ショートカットの処理を呼び、保存された画像のパスを返す。 */
async function captureBy(serviceWorker: Worker, target: Page, command: string) {
  await target.bringToFront()
  await target.evaluate(() => new Promise(requestAnimationFrame))
  await serviceWorker.evaluate(
    async ({ url, command }) => {
      const [tab] = await chrome.tabs.query({ url })
      const { __commandListeners } = globalThis as unknown as {
        __commandListeners: ((name: string, tab: chrome.tabs.Tab) => void)[]
      }
      __commandListeners.forEach((listener) => listener(command, tab))
    },
    { url: target.url(), command }
  )
  await expect
    .poll(
      () =>
        serviceWorker.evaluate(
          async () => (await chrome.downloads.search({ state: "complete" })).length
        ),
      { timeout: 60_000, intervals: [300] }
    )
    .toBeGreaterThan(0)
  return serviceWorker.evaluate(
    async () => (await chrome.downloads.search({ state: "complete" }))[0].filename
  )
}

/** 画像の中央の列に、背景の赤が何行あるかを数える。 */
function countRedRows(target: Page, file: string) {
  return target.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    const column = ctx.getImageData(bitmap.width >> 1, 0, 1, bitmap.height).data
    let rows = 0
    for (let y = 0; y < bitmap.height; y++) {
      if (column[y * 4] > 200 && column[y * 4 + 2] < 50) rows++
    }
    return rows
  }, readFileSync(file).toString("base64"))
}

/** ショートカットで 640x480 にして、表示部分を保存する。 */
async function captureAfterResize(serviceWorker: Worker, target: Page) {
  await target.bringToFront()
  await serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    const { __commandListeners } = globalThis as unknown as {
      __commandListeners: ((name: string, tab: chrome.tabs.Tab) => unknown)[]
    }
    __commandListeners.forEach((listener) => listener("resize-preset-vga", tab))
    // 補正が終わる（バッジが消えずに OK になる）まで待つ
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if ((await chrome.action.getBadgeText({ tabId: tab.id })) === "OK") return
    }
  }, target.url())
  return captureBy(serviceWorker, target, "capture-visible-download")
}

/**
 * ビューポート基準のカスタムサイズで 560x360 にして、今のサイズの表示を確かめる。
 * xvfb の 1920x1080 はスケール 200% だと 960x540 で、枠の分を足すと 640x480 も入らないので小さくする。
 */
async function resizeToSmall(
  target: Page,
  openPopup: (target: Page) => Promise<Page>,
  serviceWorker: Worker
) {
  await serviceWorker.evaluate(() =>
    chrome.storage.local.set({
      "custom-sizes": JSON.stringify([
        { id: "small", label: "Small", width: 560, height: 360, mode: "viewport" }
      ])
    })
  )
  const popup = await openPopup(target)
  await popup.getByRole("button", { name: "Viewport-based" }).click()
  await popup.locator(".custom-size-apply", { hasText: "Small" }).click()
  await waitForFinalStatus(popup)
  await popup.close()
  // 裏のタブのサイズは更新されないので、前面に戻してから開き直す（実際の popup では対象のタブが前面にある）
  await target.bringToFront()
  const reopened = await openPopup(target)
  await expect(reopened.locator(".size-value").nth(1)).toHaveText("560×360")
  await reopened.close()
}

for (const scale of [1.25, 1.5, 1.75, 2]) {
  test.describe(`表示スケール ${scale * 100}%`, () => {
    test.use({ displayScale: scale })

    test("ショートカットのリサイズ: 誤差は＋側に 1 まで、位置は揃い、画像は指定のサイズ", async ({
      openTarget,
      serviceWorker
    }) => {
      test.skip(scale === 2, "xvfb の 200% は 960x540 で、640x480 は枠の分だけ入らない")
      const target = await openTarget("/")
      await target.bringToFront()
      await serviceWorker.evaluate(
        async ({ url }) => {
          await chrome.storage.local.set({ "size-mode": JSON.stringify("viewport") })
          const [tab] = await chrome.tabs.query({ url })
          await chrome.windows.update(tab.windowId, {
            left: 103,
            top: 43,
            width: 1000,
            height: 500
          })
        },
        { url: target.url() }
      )
      await target.waitForTimeout(300)
      const file = await captureAfterResize(serviceWorker, target)
      expect(readPngSize(file)).toEqual({ width: 640, height: 480 })
      const state = await serviceWorker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url })
        const win = await chrome.windows.get(tab.windowId)
        return { tabW: tab.width, tabH: tab.height, left: win.left, top: win.top }
      }, target.url())
      expect(state.tabW).toBeGreaterThanOrEqual(640)
      expect(state.tabW).toBeLessThanOrEqual(641)
      expect(state.tabH).toBeGreaterThanOrEqual(480)
      expect(state.tabH).toBeLessThanOrEqual(481)
      const step = Number.isInteger(scale) ? 1 : scale === 1.5 ? 2 : 4
      expect((state.left as number) % step).toBe(0)
      expect((state.top as number) % step).toBe(0)
    })

    test("指定したサイズと表示部分の画像のサイズが同じ", async ({
      openTarget,
      openPopup,
      serviceWorker
    }) => {
      const target = await openTarget("/")
      await resizeToSmall(target, openPopup, serviceWorker)
      const file = await captureBy(serviceWorker, target, "capture-visible-download")
      expect(readPngSize(file)).toEqual({ width: 560, height: 360 })
    })

    for (const zoom of [1, 1.5]) {
      test(`拡大率 ${zoom * 100}% のページ全体: 幅は指定のサイズ、高さは拡大後のページで、すき間がない`, async ({
        openTarget,
        openPopup,
        serviceWorker
      }) => {
        test.setTimeout(90_000)
        const target = await openTarget("/")
        await target.setContent(HTML)
        await resizeToSmall(target, openPopup, serviceWorker)
        await serviceWorker.evaluate(
          async ({ url, zoom }) => {
            const [tab] = await chrome.tabs.query({ url })
            await chrome.tabs.setZoom(tab.id as number, zoom)
          },
          { url: target.url(), zoom }
        )
        await target.waitForTimeout(300)

        const file = await captureBy(serviceWorker, target, "capture-full-page-download")
        const size = readPngSize(file)
        expect(size.width).toBe(560)
        expect(size.height).toBe(PAGE_HEIGHT * zoom)
        expect(await countRedRows(target, file)).toBe(0)
      })
    }
  })
}

test("ウィンドウをその後に動かしたサイズでは揃えない", async ({
  openTarget,
  openPopup,
  serviceWorker
}) => {
  const target = await openTarget("/")
  await resizeToSmall(target, openPopup, serviceWorker)
  await serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    const win = await chrome.windows.get(tab.windowId)
    await chrome.windows.update(tab.windowId, {
      width: (win.width as number) + 100,
      height: win.height
    })
  }, target.url())
  await target.waitForTimeout(300)
  const file = await captureBy(serviceWorker, target, "capture-visible-download")
  expect(readPngSize(file).width).toBe(660)
})
