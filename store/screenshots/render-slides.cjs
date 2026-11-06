// ストア用スクリーンショット（1280×800、5枚、日英）を書き出す。
// <作業フォルダ> には shoot-store.cjs の出力（picker-<lang>.png / popup-<lang>.png / options-<lang>.png）と、
// LP の図解（wvr-diagram-window.png / wvr-diagram-viewport.png）を置いておく。
// 使い方: node store/screenshots/render-slides.cjs <リポジトリのルート> <作業フォルダ> <出力フォルダ>
// 出力: screenshot-<番号>.<lang>.png
const path = require("path")
const fs = require("fs")
const { pathToFileURL } = require("url")
const [ROOT, WORK, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const sharp = require(path.join(ROOT, "node_modules/sharp"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.copyFileSync(path.join(__dirname, "slides.html"), path.join(WORK, "slides.html"))
  fs.copyFileSync(path.join(ROOT, "assets/icon128.png"), path.join(WORK, "icon128.png"))
  for (const name of ["wvr-step-2.png", "wvr-step-2-en.png"]) {
    fs.copyFileSync(path.join(ROOT, "store/lp/images", name), path.join(WORK, name))
  }
  const b = await chromium.launch({ executablePath: exe })
  for (const lang of ["en", "ja"]) {
    // 設定画面は上部の本文の列だけを切り出す
    await sharp(path.join(WORK, `options-${lang}.png`))
      .extract({ left: 400, top: 40, width: 990, height: 1520 })
      .toFile(path.join(WORK, `options-crop-${lang}.png`))
    for (let n = 1; n <= 5; n++) {
      for (const dsf of [1, 2]) {
        const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dsf })
        await p.goto(pathToFileURL(path.join(WORK, "slides.html")).href + `?n=${n}&lang=${lang}`)
        await p.waitForTimeout(500)
        const name = `screenshot-${n}.${lang}.png`
        await p.screenshot({ path: dsf === 1 ? path.join(OUT, name) : path.join(WORK, `@2x-${name}`) })
        await p.close()
      }
    }
  }
  await b.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
