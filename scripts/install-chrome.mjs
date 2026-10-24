/**
 * E2Eテスト用に Chrome for Testing を取得するスクリプト。
 *
 * - チャンネルは環境変数 CHROME_CHANNEL で指定する（stable / beta / dev / canary）。
 *   未指定時は stable（ローカル確認用）。CI では beta を指定する。
 * - 取得先は .chrome-for-testing/（.gitignore 対象）。
 * - 取得した実行ファイルのパスを .chrome-for-testing/executable-path.txt に書き出す。
 *   テスト側（tests/e2e/fixtures.ts）はこのファイル、または環境変数 CHROME_PATH を参照する。
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  Browser,
  detectBrowserPlatform,
  install,
  resolveBuildId
} from "@puppeteer/browsers"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cacheDir = resolve(rootDir, ".chrome-for-testing")
const channel = (process.env.CHROME_CHANNEL || "stable").toLowerCase()
const allowedChannels = ["stable", "beta", "dev", "canary"]

if (!allowedChannels.includes(channel)) {
  console.error(
    `CHROME_CHANNEL が不正です: ${channel}（指定可能: ${allowedChannels.join(", ")}）`
  )
  process.exit(1)
}

const platform = detectBrowserPlatform()
if (!platform) {
  console.error("このOSは Chrome for Testing の取得に対応していません。")
  process.exit(1)
}

const buildId = await resolveBuildId(Browser.CHROME, platform, channel)
console.log(`Chrome for Testing (${channel}) を取得します: ${buildId}`)

const installed = await install({
  browser: Browser.CHROME,
  buildId,
  cacheDir
})

mkdirSync(cacheDir, { recursive: true })
writeFileSync(resolve(cacheDir, "executable-path.txt"), installed.executablePath, "utf8")
console.log(`取得完了: ${installed.executablePath}`)
console.log(`バージョン: ${installed.buildId}`)
