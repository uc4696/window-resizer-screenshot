// LP のデモ動画の素材を撮る。本番ビルドのポップアップを、状態ごとに 3 倍で撮影する（ja / en）。
// 使い方: node store/lp/demo/shoot.cjs <リポジトリのルート> <作業フォルダ>
// 出力: popup-<lang>-<a|b|c>.png と、カーソルの行き先の boxes-<lang>.json（CSS px、.popup-root 基準）
const path = require("path")
const fs = require("fs")
const os = require("os")
const [ROOT, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")
const ext = path.join(ROOT, "build/chrome-mv3-prod")

// 撮影する PC の画面に左右されないよう、広い画面として押せるプリセットを揃える
const fakeScreen = () => {
  const v = { width: 2560, height: 1440, availWidth: 2560, availHeight: 1392 }
  for (const k of Object.keys(v)) Object.defineProperty(screen, k, { get: () => v[k] })
}
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
  fs.mkdirSync(OUT, { recursive: true })
  for (const lang of ["ja", "en"]) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), "wvr-demo-"))
    const ctx = await chromium.launchPersistentContext(prof, {
      executablePath: exe,
      headless: false,
      viewport: { width: 300, height: 640 },
      deviceScaleFactor: 3,
      args: [
        `--disable-extensions-except=${ext}`,
        `--load-extension=${ext}`,
        `--lang=${lang}`,
        "--no-first-run"
      ]
    })
    await ctx.addInitScript(fakeScreen)
    let [w] = ctx.serviceWorkers()
    if (!w) w = await ctx.waitForEvent("serviceworker")
    const id = new URL(w.url()).host
    const p = await ctx.newPage()
    await p.emulateMedia({ colorScheme: "light" })
    await p.goto(`chrome-extension://${id}/popup.html`)
    await p.waitForTimeout(1000)
    await p.locator(".mode-button").nth(0).click()
    await p.waitForTimeout(300)
    await p.mouse.move(0, 0)
    const root = p.locator(".popup-root")
    const shot = async (state) => {
      await p.waitForTimeout(250)
      await root.screenshot({ path: path.join(OUT, `popup-${lang}-${state}.png`) })
    }
    await p.evaluate(setSizes, ["1416x735", "1400x640"])
    await shot("a")
    await p.locator(".mode-button").nth(1).click()
    await p.evaluate(setSizes, ["1416x735", "1400x640"])
    await p.mouse.move(0, 0)
    await shot("b")
    await p.evaluate(setSizes, ["1296x815", "1280x720"])
    await shot("c")

    const rb = await root.boundingBox()
    const rel = async (loc) => {
      const b = await loc.boundingBox()
      return { x: b.x - rb.x + b.width / 2, y: b.y - rb.y + b.height / 2 }
    }
    const boxes = {
      root: { w: rb.width, h: rb.height },
      viewport: await rel(p.locator(".mode-button").nth(1)),
      p720: await rel(p.locator('[data-size="1280x720"]')),
      visibleDownload: await rel(p.locator(".icon-button").nth(0)),
      fullDownload: await rel(p.locator(".icon-button").nth(2))
    }
    fs.writeFileSync(path.join(OUT, `boxes-${lang}.json`), JSON.stringify(boxes, null, 2))
    await ctx.close()
    fs.rmSync(prof, { recursive: true, force: true })
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
