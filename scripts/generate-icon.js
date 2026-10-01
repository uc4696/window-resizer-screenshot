const path = require("path")
const sharp = require("sharp")

/**
 * assets/icon-source.png（デザイン原本）から、Plasmoが要求する
 * ベースアイコン（icon.png, 512x512）と、上書き用の各サイズアイコン
 * （icon32.png, icon64.png）をまとめて生成する。
 * icon16.png / icon48.png / icon128.png は別途提供されたファイルを直接使用するため、
 * ここでは生成しない（上書き対象外）。
 */
const assetsDir = path.join(__dirname, "..", "assets")
const sourcePath = path.join(assetsDir, "icon-source.png")

const targets = [
  { file: "icon.png", size: 512 },
  { file: "icon32.png", size: 32 },
  { file: "icon64.png", size: 64 }
]

Promise.all(
  targets.map(({ file, size }) => {
    const outPath = path.join(assetsDir, file)
    return sharp(sourcePath)
      .resize(size, size)
      .png()
      .toFile(outPath)
      .then(() => console.log(`${file} generated at`, outPath))
  })
).catch((err) => {
  console.error("Failed to generate icons", err)
  process.exit(1)
})
