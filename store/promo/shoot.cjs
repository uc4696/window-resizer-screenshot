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
    await ctx.addInitScript(() => { const v = { width: 2560, height: 1440, availWidth: 2560, availHeight: 1392 }; for (const k of Object.keys(v)) Object.defineProperty(screen, k, { get: () => v[k] }) })
    let [w] = ctx.serviceWorkers(); if (!w) w = await ctx.waitForEvent("serviceworker")
    const id = new URL(w.url()).host
    for (const scheme of ["light", "dark"]) {
      const p = await ctx.newPage()
      await p.emulateMedia({ colorScheme: scheme })
      await p.setViewportSize({ width: 300, height: 600 })
      await p.goto(`chrome-extension://${id}/popup.html`)
      await p.waitForTimeout(1200)
      await p.locator(".mode-button").nth(1).click()
      await p.waitForTimeout(300)
      await p.evaluate(() => { const v = [["1936", "1175"], ["1920", "1080"]]; document.querySelectorAll(".size-value").forEach((el, i) => { el.firstChild.textContent = v[i][0]; el.lastChild.textContent = v[i][1] }); document.querySelector('[data-size="1920x1080"]')?.classList.add("is-current") })
      const el = await p.$(".popup-root")
      await el.screenshot({ path: path.join(OUT, `popup-${lang}-${scheme}.png`), scale: "device" })
      await p.close()
    }
    await ctx.close()
  }
})().catch(e => { console.error(e); process.exit(1) })
