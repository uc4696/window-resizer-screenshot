import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { test as base, expect } from "@playwright/test"

import { BUILD_PATH } from "./fixtures"

/**
 * 配布物（本番ビルド）の manifest.json の回帰テスト。
 * ブラウザは使わず、ビルド成果物そのもの（テスト用に改変する前のもの）を検証する。
 */
const test = base

const manifest = JSON.parse(readFileSync(path.join(BUILD_PATH, "manifest.json"), "utf8"))

test.describe("manifest.json（配布物の回帰チェック）", () => {
  test("権限は最小限（activeTab / storage / downloads / scripting のみ）", () => {
    expect([...manifest.permissions].sort()).toEqual(
      ["activeTab", "downloads", "scripting", "storage"].sort()
    )
  })

  test("host_permissions・tabs・system.display を要求していない", () => {
    expect(manifest.host_permissions ?? []).toEqual([])
    expect(manifest.permissions).not.toContain("tabs")
    expect(manifest.permissions).not.toContain("system.display")
    expect(manifest.content_scripts ?? []).toEqual([])
  })

  test("Manifest V3 で、バージョンが package.json と一致する", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(BUILD_PATH, "../../package.json"), "utf8")
    ) as { version: string }
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.version).toBe(pkg.version)
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test("クリップボード用の追加権限（clipboardWrite）を要求していない", () => {
    expect(manifest.permissions).not.toContain("clipboardWrite")
  })

  test("Tabler Icons の MIT ライセンス（licenses/LICENSE-tabler.txt）が配布物に同梱されている", () => {
    const license = path.join(BUILD_PATH, "licenses/LICENSE-tabler.txt")
    expect(existsSync(license)).toBe(true)
    expect(readFileSync(license, "utf8")).toContain("MIT License")
  })

  test("popup / options / background / ロケールが成果物に含まれる", () => {
    expect(existsSync(path.join(BUILD_PATH, "popup.html"))).toBe(true)
    expect(existsSync(path.join(BUILD_PATH, "options.html"))).toBe(true)
    expect(existsSync(path.join(BUILD_PATH, manifest.background.service_worker))).toBe(
      true
    )
    expect(existsSync(path.join(BUILD_PATH, "_locales/en/messages.json"))).toBe(true)
    expect(existsSync(path.join(BUILD_PATH, "_locales/ja/messages.json"))).toBe(true)
  })
})
