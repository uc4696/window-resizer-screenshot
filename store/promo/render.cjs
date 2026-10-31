const path = require("path")
const { pathToFileURL } = require("url")
const [ROOT, DIR, OUT] = process.argv.slice(2)
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")
;(async () => {
  const b = await chromium.launch({ executablePath: exe })
  for (const lang of ["ja", "en"]) {
    for (const dsf of [1, 2]) {
      const p = await b.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: dsf })
      await p.goto(pathToFileURL(path.join(DIR, "tile.html")).href + "?lang=" + lang)
      await p.waitForTimeout(500)
      const name = `promo-tile-440x280.${lang}${dsf === 2 ? "@2x" : ""}.png`
      await p.screenshot({ path: path.join(dsf === 1 ? OUT : DIR, name) })
      await p.close()
    }
  }
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
