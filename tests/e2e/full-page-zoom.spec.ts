import { readFileSync } from "node:fs"

import { expect, test } from "./fixtures"
import { readPngSize } from "./helpers"

const PAGE_HEIGHT = 2000

/**
 * 全面を青の本文で埋め、背景は赤にする。つなぎ目にすき間があると赤が出る。左端の 200px は緑で、
 * 横にはみ出すページ（非レスポンシブ）を、左端を基準に撮ることも確かめる。
 */
const HTML = `<!doctype html><html><head><title>zoom</title><style>
html,body{margin:0;background:rgb(255,0,0)}
#c{width:1800px;height:${PAGE_HEIGHT}px;background:rgb(0,0,255);position:relative}
#l{position:absolute;left:0;top:0;width:200px;height:${PAGE_HEIGHT}px;background:rgb(0,255,0)}
</style></head><body><div id="c"><div id="l"></div></div></body></html>`

test.describe("拡大中のページ全体の撮影", () => {
  for (const zoom of [1, 0.8, 1.1, 1.5, 3]) {
    test(`拡大率 ${Math.round(zoom * 100)}%: つなぎ目にすき間がなく、幅は描画エリア、高さは拡大後のページ`, async ({
      openTarget,
      serviceWorker
    }) => {
      test.setTimeout(90_000)
      const target = await openTarget("/")
      await target.setContent(HTML)
      await serviceWorker.evaluate(
        async ({ url, zoom }) => {
          const [tab] = await chrome.tabs.query({ url })
          await chrome.tabs.setZoom(tab.id as number, zoom)
        },
        { url: target.url(), zoom }
      )
      await target.bringToFront()
      await target.waitForTimeout(400)
      const areaWidth = await serviceWorker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url })
        return (await chrome.tabs.get(tab.id as number)).width as number
      }, target.url())

      await serviceWorker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url })
        const { __commandListeners } = globalThis as unknown as {
          __commandListeners: ((name: string, tab: chrome.tabs.Tab) => void)[]
        }
        __commandListeners.forEach((listener) =>
          listener("capture-full-page-download", tab)
        )
      }, target.url())
      await expect
        .poll(
          () =>
            serviceWorker.evaluate(
              async () => (await chrome.downloads.search({ state: "complete" })).length
            ),
          { timeout: 75_000, intervals: [500] }
        )
        .toBeGreaterThan(0)

      const file = await serviceWorker.evaluate(
        async () => (await chrome.downloads.search({ state: "complete" }))[0].filename
      )
      const size = readPngSize(file)
      expect(size.width).toBe(areaWidth)
      expect(size.height).toBe(Math.round(PAGE_HEIGHT * zoom))

      const { redRows, green } = await target.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D
        ctx.drawImage(bitmap, 0, 0)
        const column = ctx.getImageData(bitmap.width >> 1, 0, 1, bitmap.height).data
        let redRows = 0
        for (let y = 0; y < bitmap.height; y++) {
          if (column[y * 4] > 200 && column[y * 4 + 2] < 50) redRows++
        }
        const first = ctx.getImageData(0, 5, 1, 1).data
        return { redRows, green: first[1] > 200 && first[0] < 50 }
      }, readFileSync(file).toString("base64"))
      expect(redRows).toBe(0)
      expect(green).toBe(true)
    })
  }
})
