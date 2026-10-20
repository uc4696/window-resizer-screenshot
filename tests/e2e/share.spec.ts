import { expect, test } from "@playwright/test"

import { buildShareText, buildShareUrl } from "../../src/lib/share"

/** X共有のURL生成（純粋関数）のテスト。ブラウザは使わない。 */
test.describe("X共有URLの生成", () => {
  const STORE = "https://example.com/detail/abc"

  test("本文は メッセージ → 拡張機能名とURL → ハッシュタグ の順で改行区切りになる", () => {
    const text = buildShareText("メッセージ", STORE, "#Tag1 #Tag2")
    expect(text.split("\n")).toEqual([
      "メッセージ",
      "Window & Viewport Resizer👇",
      STORE,
      "#Tag1 #Tag2"
    ])
  })

  test("intent URL を生成し、本文は URL エンコードされて元に戻せる", () => {
    const text = buildShareText("a&b=c\n日本語", STORE, "#Chrome拡張機能")
    const url = buildShareUrl(text)
    expect(url.startsWith("https://x.com/intent/post?text=")).toBe(true)
    // 生の改行・& ・# は URL 内に残らない（クエリが壊れない）
    expect(url).not.toMatch(/[\n#]/)
    expect(new URL(url).searchParams.get("text")).toBe(text)
  })
})
