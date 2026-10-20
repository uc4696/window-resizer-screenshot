/**
 * Tabler Icons の MIT ライセンス（licenses/LICENSE-tabler.txt）を
 * 本番ビルド成果物（build/chrome-mv3-prod/licenses/）へコピーするスクリプト。
 *
 * - Plasmo は assets/ 配下の任意ファイル（アイコンと _locales 以外）をビルドへコピーしないため、ビルド後に手動でコピーする。
 * - `npm run build` の後（postbuild）と `npm run package` の前（prepackage）に自動実行される。
 * - これにより配布用ZIPにもライセンス全文が含まれる（MIT の「著作権表示・許諾表示を同梱する」条件）。
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(rootDir, "licenses/LICENSE-tabler.txt")
const buildDir = resolve(rootDir, "build/chrome-mv3-prod")

if (!existsSync(source)) {
  console.error(`ライセンスファイルが見つかりません: ${source}`)
  process.exit(1)
}

if (!existsSync(buildDir)) {
  console.error(
    `本番ビルドが見つかりません: ${buildDir}（先に npm run build を実行してください）`
  )
  process.exit(1)
}

const destDir = resolve(buildDir, "licenses")
mkdirSync(destDir, { recursive: true })
copyFileSync(source, resolve(destDir, "LICENSE-tabler.txt"))
console.log("licenses/LICENSE-tabler.txt を成果物へコピーしました")
