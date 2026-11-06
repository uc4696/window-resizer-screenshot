// LP のデモ動画を書き出す。scene.html を 1 コマずつ撮り、ffmpeg で MP4 にする（ja / en）。
// 使い方: node store/lp/demo/render.cjs <リポジトリのルート> <作業フォルダ> <出力フォルダ> [ffmpeg のパス] [--check]
// <作業フォルダ> には shoot.cjs の出力を置いておく。
// --check は MP4 を作らず、確認用のコマ（check-<lang>.png）だけを書き出す。
// 出力: wvr-demo{,-en}.mp4 と wvr-demo-poster{,-en}.jpg
// 変換の設定は最初の動画と同じ（libx264、crf 23、30fps、yuv420p、faststart、音声なし）。
const path = require("path")
const fs = require("fs")
const { execFileSync } = require("child_process")
const { pathToFileURL } = require("url")
const args = process.argv.slice(2)
const CHECK = args.includes("--check")
const [ROOT, WORK, OUT, FFMPEG = "ffmpeg"] = args.filter((a) => a !== "--check")
const { chromium } = require(path.join(ROOT, "node_modules/@playwright/test"))
const exe = path.join(ROOT, ".chrome-for-testing/chrome/win64-155.0.8059.84/chrome-win64/chrome.exe")
const FPS = 30

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.copyFileSync(path.join(__dirname, "scene.html"), path.join(WORK, "scene.html"))
  fs.copyFileSync(path.join(ROOT, "assets/icon32.png"), path.join(WORK, "icon32.png"))
  const demoHtml = fs.readFileSync(path.join(ROOT, "store/screenshots/demo-page.html"), "utf8")
  const b = await chromium.launch({ executablePath: exe })
  for (const lang of ["ja", "en"]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
    await p.goto(pathToFileURL(path.join(WORK, "scene.html")).href)
    const boxes = JSON.parse(fs.readFileSync(path.join(WORK, `boxes-${lang}.json`), "utf8"))
    const height = await p.evaluate((o) => window.init(o), { lang, boxes, demoHtml })
    const duration = await p.evaluate(() => window.DURATION)
    const draw = async (t) => {
      await p.evaluate((t) => {
        window.seek(t)
        return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
      }, t)
    }

    if (CHECK) {
      const times = [0.6, 1.6, 2.8, 4.6, 5.9, 7.2, 9.9, 11.4, 13.4]
      const shots = []
      for (const t of times) {
        await draw(t)
        shots.push(await p.screenshot({ type: "png" }))
      }
      const sharp = require(path.join(ROOT, "node_modules/sharp"))
      const W = 640, H = 360
      const tiles = await Promise.all(shots.map((s) => sharp(s).resize(W, H).toBuffer()))
      await sharp({ create: { width: W * 3, height: H * 3, channels: 3, background: "#000" } })
        .composite(tiles.map((input, i) => ({ input, left: (i % 3) * W, top: Math.floor(i / 3) * H })))
        .png()
        .toFile(path.join(OUT, `check-${lang}.png`))
      console.log(lang, "height", height, "duration", duration)
      await p.close()
      continue
    }

    const dir = path.join(WORK, `frames-${lang}`)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const total = Math.round(duration * FPS)
    for (let i = 0; i < total; i++) {
      await draw(i / FPS)
      await p.screenshot({
        path: path.join(dir, `${String(i).padStart(4, "0")}.jpg`),
        type: "jpeg",
        quality: 96
      })
    }
    await p.close()
    const suffix = lang === "ja" ? "" : "-en"
    const mp4 = path.join(OUT, `wvr-demo${suffix}.mp4`)
    execFileSync(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS),
      "-i", path.join(dir, "%04d.jpg"),
      "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-r", String(FPS),
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4
    ])
    // ポスターは、ウィンドウが指定のサイズになった場面
    fs.copyFileSync(path.join(dir, `${String(Math.round(4.8 * FPS)).padStart(4, "0")}.jpg`), path.join(OUT, `wvr-demo-poster${suffix}.jpg`))
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(lang, "height", height, "frames", total, (fs.statSync(mp4).size / 1048576).toFixed(2) + " MB")
  }
  await b.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
