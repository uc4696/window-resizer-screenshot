/**
 * ストアの評価のお願い（と寄付の案内）をポップアップに出すかどうか。
 * インストールから REVIEW_PROMPT_MIN_DAYS 日たったあと、リサイズか撮影に成功したときに
 * 「出す」印を付け、次にポップアップを開いたときに出す（操作の途中で割り込まないため）。
 * アップデートしたときは、「表示しない」を選んでいても、アップデートから同じ日数たったあとの
 * 操作でもう一度出す（評価してくれた人には出さない）。
 *
 * 単体テスト（node）から読み込むので、このファイルでは `~lib` などの別名を import しない。
 * 値は @plasmohq/storage を通さず chrome.storage.local に直接保存する。
 */
export const REVIEW_PROMPT_KEY = "reviewPrompt"
/** インストールした日時（ISO 文字列） */
export const INSTALLED_AT_KEY = "installedAt"
/** インストールから最初に出すまでの日数。「あとで」を選んだときも、そこからこの日数あける */
export const REVIEW_PROMPT_MIN_DAYS = 3

export interface ReviewPromptStorage {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface ReviewPromptState {
  /** 次にポップアップを開いたときに出す */
  pending: boolean
  /** 評価した・「表示しない」を選んだら、もう出さない（アップデートで戻す） */
  closed: boolean
  /** 「ストアで評価する」を押した。アップデートしても出さない */
  rated?: boolean
  /** 「あとで」を選んだときの、次に出してよい日時（ミリ秒） */
  postponedUntil?: number
}

export const DEFAULT_REVIEW_PROMPT_STATE: ReviewPromptState = {
  pending: false,
  closed: false
}

const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeReviewPromptState(value: unknown): ReviewPromptState {
  if (!value || typeof value !== "object") return { ...DEFAULT_REVIEW_PROMPT_STATE }
  const source = value as Record<string, unknown>
  const postponedUntil = Number(source.postponedUntil)
  return {
    pending: source.pending === true,
    closed: source.closed === true,
    ...(source.rated === true ? { rated: true } : {}),
    ...(Number.isFinite(postponedUntil) && postponedUntil > 0 ? { postponedUntil } : {})
  }
}

/**
 * 印を付けるかどうか。インストールから REVIEW_PROMPT_MIN_DAYS 日
 * （「あとで」のあとは、そこから同じ日数）たっていて、まだ出していなければ付ける。
 */
export function isReviewPromptDue({
  state,
  installedAt,
  now = Date.now()
}: {
  state: ReviewPromptState
  installedAt: string | undefined
  now?: number
}): boolean {
  if (state.closed || state.rated || state.pending) return false
  const installed = installedAt ? Date.parse(installedAt) : Number.NaN
  if (Number.isNaN(installed)) return false
  const notBefore = Math.max(
    installed + REVIEW_PROMPT_MIN_DAYS * DAY_MS,
    state.postponedUntil ?? 0
  )
  return now >= notBefore
}

/** ポップアップに出すかどうか */
export function shouldShowReviewPrompt(state: ReviewPromptState): boolean {
  return state.pending && !state.closed && !state.rated
}

async function saveState(
  state: ReviewPromptState,
  storage: ReviewPromptStorage
): Promise<ReviewPromptState> {
  await storage.set({ [REVIEW_PROMPT_KEY]: state })
  return state
}

export async function loadReviewPromptState(
  storage: ReviewPromptStorage = chrome.storage.local
): Promise<ReviewPromptState> {
  const stored = await storage.get(REVIEW_PROMPT_KEY)
  return normalizeReviewPromptState(stored[REVIEW_PROMPT_KEY])
}

/**
 * インストールした日時を記録する（service worker が起きるたびに呼ぶ。記録があれば何もしない）。
 * この仕組みより前から入れている環境では、記録がないので、最初に動いたときを起点にする。
 */
export async function ensureInstalledAt(
  storage: ReviewPromptStorage = chrome.storage.local,
  now: string = new Date().toISOString()
): Promise<string> {
  const stored = await storage.get(INSTALLED_AT_KEY)
  const value = stored[INSTALLED_AT_KEY]
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value
  await storage.set({ [INSTALLED_AT_KEY]: now })
  return now
}

/** リサイズ・撮影に成功したときに呼ぶ。条件を満たせば「出す」印を付ける */
export async function markReviewPromptOnUse(
  storage: ReviewPromptStorage = chrome.storage.local,
  now: number = Date.now()
): Promise<ReviewPromptState> {
  const state = await loadReviewPromptState(storage)
  const installedAt = await ensureInstalledAt(storage, new Date(now).toISOString())
  if (!isReviewPromptDue({ state, installedAt, now })) return state
  return saveState({ ...state, pending: true }, storage)
}

/** 「あとで」: 今から REVIEW_PROMPT_MIN_DAYS 日たったあとの、次の操作でもう一度出す */
export async function postponeReviewPrompt(
  storage: ReviewPromptStorage = chrome.storage.local,
  now: number = Date.now()
): Promise<ReviewPromptState> {
  const state = await loadReviewPromptState(storage)
  return saveState(
    {
      ...state,
      pending: false,
      postponedUntil: now + REVIEW_PROMPT_MIN_DAYS * DAY_MS
    },
    storage
  )
}

/** 「表示しない」: アップデートするまで出さない。rated なら評価した（アップデートしても出さない） */
export async function closeReviewPrompt(
  { rated = false }: { rated?: boolean } = {},
  storage: ReviewPromptStorage = chrome.storage.local
): Promise<ReviewPromptState> {
  const state = await loadReviewPromptState(storage)
  return saveState(
    { ...state, pending: false, closed: true, ...(rated ? { rated: true } : {}) },
    storage
  )
}

/**
 * アップデートしたとき: 「表示しない」を取り消し、アップデートから REVIEW_PROMPT_MIN_DAYS 日
 * たったあとの操作でもう一度出す。評価してくれた人はそのまま。
 */
export async function resetReviewPromptOnUpdate(
  storage: ReviewPromptStorage = chrome.storage.local,
  now: number = Date.now()
): Promise<ReviewPromptState> {
  const state = await loadReviewPromptState(storage)
  if (state.rated) return state
  return saveState(
    {
      pending: false,
      closed: false,
      postponedUntil: now + REVIEW_PROMPT_MIN_DAYS * DAY_MS
    },
    storage
  )
}
