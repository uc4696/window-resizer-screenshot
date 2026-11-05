import assert from "node:assert/strict"
import test from "node:test"

import {
  closeReviewPrompt,
  DEFAULT_REVIEW_PROMPT_STATE,
  ensureInstalledAt,
  INSTALLED_AT_KEY,
  isReviewPromptDue,
  loadReviewPromptState,
  markReviewPromptOnUse,
  normalizeReviewPromptState,
  postponeReviewPrompt,
  resetReviewPromptOnUpdate,
  REVIEW_PROMPT_KEY,
  shouldShowReviewPrompt
} from "../../src/lib/review-prompt.ts"

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (items) => {
      Object.assign(data, items)
    }
  }
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-11-10T00:00:00.000Z")
const iso = (ms) => new Date(ms).toISOString()

test("インストールから 3 日たってから、リサイズ・撮影の成功で印を付ける", async () => {
  const early = memoryStorage({ [INSTALLED_AT_KEY]: iso(NOW - 2 * DAY) })
  assert.equal((await markReviewPromptOnUse(early, NOW)).pending, false)

  const storage = memoryStorage({ [INSTALLED_AT_KEY]: iso(NOW - 3 * DAY) })
  const state = await markReviewPromptOnUse(storage, NOW)
  assert.equal(state.pending, true)
  assert.equal(shouldShowReviewPrompt(await loadReviewPromptState(storage)), true)
})

test("インストールの記録がなければ、そのときを起点にする", async () => {
  const storage = memoryStorage()
  assert.equal((await markReviewPromptOnUse(storage, NOW)).pending, false)
  assert.equal(storage.data[INSTALLED_AT_KEY], iso(NOW))
  assert.equal(await ensureInstalledAt(storage, iso(NOW + DAY)), iso(NOW))
  assert.equal((await markReviewPromptOnUse(storage, NOW + 3 * DAY)).pending, true)
})

test("壊れたインストール日時は記録し直す", async () => {
  const storage = memoryStorage({ [INSTALLED_AT_KEY]: "broken" })
  assert.equal(await ensureInstalledAt(storage, iso(NOW)), iso(NOW))
  assert.equal(storage.data[INSTALLED_AT_KEY], iso(NOW))
})

test("「あとで」は、そこから 3 日たったあとの操作でもう一度出す", async () => {
  const storage = memoryStorage({
    [INSTALLED_AT_KEY]: iso(NOW - 10 * DAY),
    [REVIEW_PROMPT_KEY]: { pending: true, closed: false }
  })
  const later = await postponeReviewPrompt(storage, NOW)
  assert.equal(shouldShowReviewPrompt(later), false)
  assert.equal((await markReviewPromptOnUse(storage, NOW + 2 * DAY)).pending, false)
  assert.equal((await markReviewPromptOnUse(storage, NOW + 3 * DAY)).pending, true)
})

test("「表示しない」と評価のあとは、もう出さない", async () => {
  const storage = memoryStorage({
    [INSTALLED_AT_KEY]: iso(NOW - 10 * DAY),
    [REVIEW_PROMPT_KEY]: { pending: true, closed: false }
  })
  const closed = await closeReviewPrompt({}, storage)
  assert.equal(shouldShowReviewPrompt(closed), false)
  assert.equal((await markReviewPromptOnUse(storage, NOW)).pending, false)
  assert.equal(
    isReviewPromptDue({ state: closed, installedAt: iso(NOW - 10 * DAY), now: NOW }),
    false
  )
})

test("壊れた値は初めの状態に戻す", () => {
  assert.deepEqual(normalizeReviewPromptState("x"), DEFAULT_REVIEW_PROMPT_STATE)
  assert.deepEqual(
    normalizeReviewPromptState({ pending: "yes", closed: 1, postponedUntil: -5 }),
    DEFAULT_REVIEW_PROMPT_STATE
  )
})

test("アップデートしたら「表示しない」を取り消し、アップデートから 3 日たったあとの操作で出す", async () => {
  const storage = memoryStorage({ [INSTALLED_AT_KEY]: iso(NOW - 30 * DAY) })
  await closeReviewPrompt({}, storage)
  assert.equal((await markReviewPromptOnUse(storage, NOW)).pending, false)

  await resetReviewPromptOnUpdate(storage, NOW)
  assert.equal((await markReviewPromptOnUse(storage, NOW + 2 * DAY)).pending, false)
  assert.equal((await markReviewPromptOnUse(storage, NOW + 3 * DAY)).pending, true)
})

test("評価してくれた人には、アップデートしても出さない", async () => {
  const storage = memoryStorage({ [INSTALLED_AT_KEY]: iso(NOW - 30 * DAY) })
  const rated = await closeReviewPrompt({ rated: true }, storage)
  assert.equal(rated.rated, true)
  await resetReviewPromptOnUpdate(storage, NOW)
  assert.equal((await markReviewPromptOnUse(storage, NOW + 10 * DAY)).pending, false)
  assert.equal(shouldShowReviewPrompt({ ...rated, pending: true }), false)
})
