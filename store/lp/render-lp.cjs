// LP 用画像を書き出す。<作業フォルダ> には shoot-lp.cjs の出力と、LP の旧ステップ画像
// （wvr-step-2.png / wvr-step-2-en.png / wvr-step-3.png / wvr-step-3-en.png）を置いておく。
// 使い方: node store/lp/render-lp.cjs <リポジトリのルート> <作業フォルダ> <出力フォルダ>
const path = require("path")
const fs = require("fs")
const { pathToFileURL } = require("url")
const [ROOT, WORK, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const sharp = require(path.join(ROOT, "node_modules/sharp"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.copyFileSync(path.join(__dirname, "compose.html"), path.join(WORK, "compose.html"))
  fs.copyFileSync(path.join(ROOT, "assets/icon32.png"), path.join(WORK, "icon32.png"))
  const boxes = fs.readFileSync(path.join(WORK, "boxes.json"), "utf8")
  const b = await chromium.launch({ executablePath: exe })
  for (const lang of ["ja", "en"]) {
    for (const step of ["2", "3"]) {
      const p = await b.newPage({ viewport: { width: 1200, height: 750 } })
      const url = new URL(pathToFileURL(path.join(WORK, "compose.html")).href)
      url.search = new URLSearchParams({ lang, step, boxes }).toString()
      await p.goto(url.href)
      await p.waitForTimeout(500)
      const name = lang === "ja" ? `wvr-step-${step}.png` : `wvr-step-${step}-en.png`
      await p.screenshot({ path: path.join(OUT, name) })
      await p.close()
    }
    // ヒーローのポップアップは表示幅 300px の2倍（600px）で書き出す
    await sharp(path.join(WORK, `popup-${lang}-hero.png`))
      .resize({ width: 600 })
      .toFile(path.join(OUT, `wvr-popup-${lang}.png`))
  }
  await b.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
