// ストア用スクリーンショットの素材を撮る（英語 UI）。
// E2E と同じく、本番ビルドの複製に host_permissions だけを足して読み込む（配布物は変更しない）。
// 使い方: node store/screenshots/shoot-store.cjs <リポジトリのルート> <出力フォルダ>
// 出力: picker.png（範囲選択 UI）/ zoom.png（拡大率の確認）/ options.png（設定画面）
const path = require("path")
const fs = require("fs")
const os = require("os")
const http = require("http")
const [ROOT, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")

;(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "wvr-store-"))
  const ext = path.join(work, "extension")
  fs.cpSync(path.join(ROOT, "build/chrome-mv3-prod"), ext, { recursive: true })
  const mf = JSON.parse(fs.readFileSync(path.join(ext, "manifest.json"), "utf8"))
  mf.host_permissions = ["<all_urls>"]
  fs.writeFileSync(path.join(ext, "manifest.json"), JSON.stringify(mf))

  const page = fs.readFileSync(path.join(__dirname, "demo-page.html"))
  const server = http.createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(page)
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const url = `http://127.0.0.1:${server.address().port}/`

  const ctx = await chromium.launchPersistentContext(path.join(work, "profile"), {
    executablePath: exe,
    headless: false,
    viewport: { width: 1100, height: 680 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--lang=en-US", "--no-first-run"]
  })
  let [sw] = ctx.serviceWorkers()
  if (!sw) sw = await ctx.waitForEvent("serviceworker")
  const id = new URL(sw.url()).host

  // popup の「アクティブタブ」を対象ページに差し替えて開く（tests/e2e/fixtures.ts と同じ方法）
  const openPopup = async (target) => {
    await target.bringToFront()
    const info = await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      return { tabId: tab.id, windowId: tab.windowId }
    })
    const popup = await ctx.newPage()
    await popup.setViewportSize({ width: 300, height: 640 })
    await popup.addInitScript(({ tabId, windowId }) => {
      const orig = chrome.tabs.query.bind(chrome.tabs)
      chrome.tabs.query = (q) =>
        q?.active && q?.currentWindow ? chrome.tabs.get(tabId).then((t) => [t]) : orig(q)
      chrome.windows.getCurrent = () => chrome.windows.get(windowId)
    }, info)
    await popup.goto(`chrome-extension://${id}/popup.html`)
    await popup.waitForTimeout(800)
    return { popup, info }
  }

  // 1. 範囲選択 UI
  const target = await ctx.newPage()
  await target.goto(url)
  await target.waitForTimeout(500)
  {
    const { popup } = await openPopup(target)
    await popup.getByRole("button", { name: "Choose a scrollable area to capture" }).click()
    await target.bringToFront()
    await target.waitForTimeout(800)
    await target.mouse.move(640, 300)
    await target.waitForTimeout(400)
    await target.mouse.click(640, 300)
    await target.waitForTimeout(600)
    await target.screenshot({ path: path.join(OUT, "picker.png") })
    await target.keyboard.press("Escape")
    if (!popup.isClosed()) await popup.close()
  }

  // 2. 拡大率の確認（対象タブを 125% にしてからプリセットを押す）
  {
    const { popup, info } = await openPopup(target)
    await sw.evaluate((tabId) => chrome.tabs.setZoom(tabId, 1.25), info.tabId)
    await popup.reload()
    await popup.waitForTimeout(800)
    // 撮影用ウィンドウの実寸は不自然なので、表示値だけそれらしい値に差し替える
    await popup.evaluate(() => {
      const vals = [...document.querySelectorAll("*")].filter(
        (el) => el.children.length === 0 && /^[0-9]+ x [0-9]+$/.test(el.textContent.trim())
      )
      if (vals[0]) vals[0].textContent = "1536 x 864"
      if (vals[1]) vals[1].textContent = "1229 x 595"
    })
    await popup.getByRole("button", { name: /^HD/ }).first().click()
    await popup.waitForTimeout(600)
    await popup.locator(".popup-root").screenshot({ path: path.join(OUT, "zoom.png") })
    await popup.close()
    await sw.evaluate((tabId) => chrome.tabs.setZoom(tabId, 1), info.tabId)
  }

  // 3. 設定画面
  {
    const opt = await ctx.newPage()
    await opt.setViewportSize({ width: 900, height: 1400 })
    await opt.goto(`chrome-extension://${id}/options.html`)
    await opt.waitForTimeout(800)
    await opt.screenshot({ path: path.join(OUT, "options.png"), fullPage: true })
  }

  await ctx.close()
  server.close()
  fs.rmSync(work, { recursive: true, force: true })
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
