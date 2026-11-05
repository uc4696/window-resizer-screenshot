import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  COMMAND_NAMES,
  CUSTOM_SLOT_COUNT,
  normalizeCustomSizeSlots,
  parseCommand
} from "../../src/lib/commands.ts"

const manifest = JSON.parse(readFileSync("package.json", "utf8")).manifest
const locale = (lang) =>
  JSON.parse(readFileSync(`assets/_locales/${lang}/messages.json`, "utf8"))

test("manifest の commands と COMMAND_NAMES が一致する", () => {
  assert.deepEqual(Object.keys(manifest.commands).sort(), [...COMMAND_NAMES].sort())
})

test("既定のキーをひとつも割り当てない", () => {
  for (const command of Object.values(manifest.commands)) {
    assert.equal(command.suggested_key, undefined)
  }
})

test("すべてのコマンドの説明が en / ja の両方にある", () => {
  const en = locale("en")
  const ja = locale("ja")
  for (const command of Object.values(manifest.commands)) {
    const key = /^__MSG_(.+)__$/.exec(command.description)?.[1]
    assert.ok(key, command.description)
    assert.ok(en[key]?.message, `en: ${key}`)
    assert.ok(ja[key]?.message, `ja: ${key}`)
  }
})

test("コマンド名を中身に変換する", () => {
  assert.deepEqual(parseCommand("resize-preset-4k"), {
    kind: "resize-preset",
    presetId: "4k"
  })
  assert.deepEqual(parseCommand("resize-custom-5"), { kind: "resize-custom", slot: 5 })
  assert.deepEqual(parseCommand("capture-full-page-copy"), {
    kind: "capture",
    mode: "full-page",
    action: "copy"
  })
  assert.deepEqual(parseCommand("capture-pick"), { kind: "pick" })
  assert.deepEqual(parseCommand("capture-visible-delay-10"), {
    kind: "capture-delayed",
    seconds: 10
  })
})

test("知らない名前や枠の外は null", () => {
  assert.equal(parseCommand("_execute_action"), null)
  assert.equal(parseCommand(`resize-custom-${CUSTOM_SLOT_COUNT + 1}`), null)
  assert.equal(parseCommand("resize-preset-nope"), null)
})

test("枠の保存値を枠の数にそろえ、不正な値は空にする", () => {
  assert.deepEqual(normalizeCustomSizeSlots(undefined), ["", "", "", "", ""])
  assert.deepEqual(normalizeCustomSizeSlots(["a", 1, null]), ["a", "", "", "", ""])
  assert.equal(normalizeCustomSizeSlots(new Array(9).fill("x")).length, CUSTOM_SLOT_COUNT)
})
