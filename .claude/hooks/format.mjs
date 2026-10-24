/**
 * PostToolUse（Write|Edit）フック: 編集されたファイルを Prettier で整形する。
 *
 * - stdin の JSON から対象ファイルのパスを取り出す（jq に依存しない）。
 * - プロジェクト外のファイル（スクラッチパッド等）は対象外。
 * - README の表などを崩さないよう、.ts / .tsx / .js / .mjs / .css のみ対象にする。
 * - .prettierrc を反映し、.prettierignore 対象は除外する。
 */
import { readFileSync, writeFileSync } from "node:fs"
import { extname, relative, resolve } from "node:path"

import * as prettier from "prettier"

const targets = [".ts", ".tsx", ".js", ".mjs", ".css"]

const input = JSON.parse(readFileSync(0, "utf8"))
const file = input.tool_response?.filePath ?? input.tool_input?.file_path

if (!file || !targets.includes(extname(file))) process.exit(0)

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
const rel = relative(projectDir, resolve(file))
if (rel.startsWith("..") || resolve(rel) === rel) process.exit(0)

const { ignored } = await prettier.getFileInfo(file, {
  ignorePath: ".prettierignore"
})
if (ignored) process.exit(0)

const source = readFileSync(file, "utf8")
const options = (await prettier.resolveConfig(file)) ?? {}
const formatted = await prettier.format(source, { ...options, filepath: file })
if (formatted !== source) writeFileSync(file, formatted)
