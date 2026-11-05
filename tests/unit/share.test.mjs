import assert from "node:assert/strict"
import { test } from "node:test"

import { en } from "../../src/lib/i18n/messages.en.ts"
import { ja } from "../../src/lib/i18n/messages.ja.ts"
import {
  buildShareTargetUrl,
  buildShareText,
  SHARE_TARGETS
} from "../../src/lib/share.ts"

const STORE = "https://example.com/detail/abc"
const content = { message: "a&b 日本語", storeUrl: STORE, hashtags: "#Tag" }
const param = (id, name) =>
  new URL(buildShareTargetUrl(id, content)).searchParams.get(name)

test("本文を渡せる SNS には本文全体が入る", () => {
  const text = buildShareText(content.message, STORE, content.hashtags)
  assert.equal(param("x", "text"), text)
  assert.equal(param("threads", "text"), text)
  assert.equal(param("bluesky", "text"), text)
})

test("URL しか渡せない SNS にはストアの URL が入る", () => {
  assert.equal(param("facebook", "u"), STORE)
  assert.equal(param("linkedin", "url"), STORE)
})

test("LINE と Reddit は URL と短い文を別に渡す", () => {
  assert.equal(param("line", "url"), STORE)
  assert.equal(param("line", "text"), content.message)
  assert.equal(param("reddit", "url"), STORE)
  assert.equal(param("reddit", "title"), "Window & Viewport Resizer")
})

test("すべての共有先の URL を作れる", () => {
  for (const { id } of SHARE_TARGETS) {
    assert.ok(buildShareTargetUrl(id, content).startsWith("https://"), id)
  }
})

test("Bluesky の投稿文は上限（300文字）に収まる", () => {
  const store =
    "https://chromewebstore.google.com/detail/kaikockbajglbkgoeepfbamdknadhiji"
  const segmenter = new Intl.Segmenter()
  for (const m of [en, ja]) {
    const text = buildShareText(m.shareText, store, m.shareHashtags)
    assert.ok([...segmenter.segment(text)].length <= 300, text)
  }
})
