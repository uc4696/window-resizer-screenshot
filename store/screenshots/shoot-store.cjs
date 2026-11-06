// ストア用スクリーンショットの素材を撮る（英語 UI）。
// E2E と同じく、本番ビルドの複製に host_permissions だけを足して読み込む（配布物は変更しない）。
// 使い方: node store/screenshots/shoot-store.cjs <リポジトリのルート> <出力フォルダ> <en|ja>
// 出力: picker-<lang>.png（範囲選択 UI）/ popup-<lang>.png（ポップアップ）/ options-<lang>.png（設定画面）
const path = require("path")
const fs = require("fs")
const os = require("os")
const http = require("http")
const [ROOT, OUT, LANG = "en"] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")

// 撮影する PC の画面に左右されないよう、広い画面として押せるプリセットを揃える
const fakeScreen = () => {
  const v = { width: 2560, height: 1440, availWidth: 2560, availHeight: 1392 }
  for (const k of Object.keys(v)) Object.defineProperty(screen, k, { get: () => v[k] })
}
// 今のサイズの数字を差し替える（size-value は 数字・×・数字 の並び）
const setSizes = ([win, vp]) => {
  document.querySelectorAll(".size-value").forEach((el, i) => {
    const [w, h] = (i === 0 ? win : vp).split("x")
    el.firstChild.textContent = w
    el.lastChild.textContent = h
  })
  const cur = document.querySelector(`[data-size="${vp}"]`)
  if (cur) cur.classList.add("is-current")
}

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
  const url = `http://127.0.0.1:${server.address().port}/?lang=${LANG}`

  const ctx = await chromium.launchPersistentContext(path.join(work, "profile"), {
    executablePath: exe,
    headless: false,
    viewport: { width: 1100, height: 680 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--lang=${LANG === "ja" ? "ja" : "en-US"}`, "--no-first-run"]
  })
  await ctx.addInitScript(fakeScreen)
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
    await popup.locator(".icon-button").last().click()
    await target.bringToFront()
    await target.waitForTimeout(800)
    await target.mouse.move(640, 300)
    await target.waitForTimeout(400)
    await target.mouse.click(640, 300)
    await target.waitForTimeout(600)
    await target.screenshot({ path: path.join(OUT, `picker-${LANG}.png`) })
    await target.keyboard.press("Escape")
    if (!popup.isClosed()) await popup.close()
  }

  // 2. ポップアップ（ビューポート基準で 1280x720）
  {
    const { popup } = await openPopup(target)
    await popup.locator(".mode-button").nth(1).click()
    await popup.waitForTimeout(300)
    await popup.evaluate(setSizes, ["1296x815", "1280x720"])
    await popup.mouse.move(0, 0)
    await popup.waitForTimeout(200)
    await popup.locator(".popup-root").screenshot({ path: path.join(OUT, `popup-${LANG}.png`) })
    await popup.close()
  }

  // 3. 設定画面
  {
    const opt = await ctx.newPage()
    await opt.setViewportSize({ width: 900, height: 1400 })
    await opt.goto(`chrome-extension://${id}/options.html`)
    await opt.waitForTimeout(800)
    await opt.screenshot({ path: path.join(OUT, `options-${LANG}.png`), fullPage: true })
  }

  await ctx.close()
  server.close()
  fs.rmSync(work, { recursive: true, force: true })
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
