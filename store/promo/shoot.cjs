const path = require("path"), fs = require("fs"), os = require("os")
const ROOT = process.argv[2], OUT = process.argv[3]
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")
const ext = path.join(ROOT, "build/chrome-mv3-prod")
;(async () => {
  for (const lang of ["ja", "en"]) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), "wvr-tile-"))
    const ctx = await chromium.launchPersistentContext(prof, {
      executablePath: exe, headless: false, viewport: { width: 300, height: 600 }, deviceScaleFactor: 3,
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--lang=${lang}`, "--no-first-run"]
    })
    let [w] = ctx.serviceWorkers(); if (!w) w = await ctx.waitForEvent("serviceworker")
    const id = new URL(w.url()).host
    for (const scheme of ["light", "dark"]) {
      const p = await ctx.newPage()
      await p.emulateMedia({ colorScheme: scheme })
      await p.setViewportSize({ width: 300, height: 600 })
      await p.goto(`chrome-extension://${id}/popup.html`)
      await p.waitForTimeout(1200)
      await p.evaluate(() => { for (const el of document.querySelectorAll("*")) if (el.children.length === 0 && /^[0-9]+ x [0-9]+$/.test(el.textContent.trim())) { el.textContent = el.textContent.trim() === "0 x 0" ? "1920 x 951" : "1920 x 1080" } })
      const el = await p.$(".popup-root")
      await el.screenshot({ path: path.join(OUT, `popup-${lang}-${scheme}.png`), scale: "device" })
      await p.close()
    }
    await ctx.close()
  }
})().catch(e => { console.error(e); process.exit(1) })
