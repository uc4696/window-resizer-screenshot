// LP 用のポップアップ画像を撮る（本番ビルドを読み込み、ja/en × 状態ごとに3倍で撮影）。
// 使い方: node store/lp/shoot-lp.cjs <リポジトリのルート> <出力フォルダ>
// 出力: popup-<lang>-<state>.png と、合成で注釈を置く位置の boxes.json（CSS px、.popup-root 基準）
const path = require("path")
const fs = require("fs")
const os = require("os")
const [ROOT, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = fs.readFileSync(path.join(ROOT, ".chrome-for-testing/executable-path.txt"), "utf8").trim()
const chrome = fs.existsSync(exe)
  ? exe
  : path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")
const ext = path.join(ROOT, "build/chrome-mv3-prod")

// state: [表示するウィンドウ値, ビューポート値, ホバーするボタン]
const STATES = {
  hero: ["1936x1175", "1920x1080", null],
  step2: ["1936x1096", "1920x993", "FHD"],
  step3: ["1936x1096", "1920x993", null]
}

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
  const boxes = {}
  for (const lang of ["ja", "en"]) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), "wvr-lp-"))
    const ctx = await chromium.launchPersistentContext(prof, {
      executablePath: chrome,
      headless: false,
      viewport: { width: 300, height: 640 },
      deviceScaleFactor: 3,
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--lang=${lang}`, "--no-first-run"]
    })
    await ctx.addInitScript(fakeScreen)
    let [w] = ctx.serviceWorkers()
    if (!w) w = await ctx.waitForEvent("serviceworker")
    const id = new URL(w.url()).host
    for (const [state, [win, vp, hover]] of Object.entries(STATES)) {
      const p = await ctx.newPage()
      await p.emulateMedia({ colorScheme: "light" })
      await p.goto(`chrome-extension://${id}/popup.html`)
      await p.waitForTimeout(1000)
      await p.getByRole("button", { name: lang === "ja" ? "ビューポート基準" : "Viewport-based" }).click()
      await p.waitForTimeout(500)
      await p.evaluate(setSizes, [win, vp])
      const root = await p.$(".popup-root")
      const rb = await root.boundingBox()
      const rel = async (loc) => {
        const b = await loc.boundingBox()
        return { x: b.x - rb.x, y: b.y - rb.y, w: b.width, h: b.height }
      }
      boxes[`${lang}-${state}`] = {
        root: { w: rb.width, h: rb.height },
        fhd: await rel(p.getByRole("button", { name: /^FHD/ }).first()),
        visibleDownload: await rel(p.locator(".icon-button").first())
      }
      if (hover) await p.getByRole("button", { name: /^FHD/ }).first().hover()
      else await p.mouse.move(0, 0)
      await p.waitForTimeout(300)
      await root.screenshot({ path: path.join(OUT, `popup-${lang}-${state}.png`) })
      await p.close()
    }
    await ctx.close()
  }
  fs.writeFileSync(path.join(OUT, "boxes.json"), JSON.stringify(boxes, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
