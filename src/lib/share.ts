/** X（旧Twitter）の投稿画面（Web Intent）。 */
const X_INTENT_URL = "https://x.com/intent/post"

/**
 * 👇（U+1F447）。ビルド時にサロゲートペアが壊れる事象を避けるため、コードポイントで指定する。
 */
const POINTING_DOWN = String.fromCodePoint(0x1f447)

/**
 * 投稿本文を組み立てる。
 * 「メッセージ / 拡張機能名 + URL / ハッシュタグ」を改行区切りで並べる。
 */
export function buildShareText(
  message: string,
  storeUrl: string,
  hashtags: string
): string {
  return `${message}\nWindow & Viewport Resizer${POINTING_DOWN}\n${storeUrl}\n${hashtags}`
}

/** 共有先（popup に並べる順）。ブランド名は翻訳しない。 */
export const SHARE_TARGETS = [
  { id: "x", name: "X" },
  { id: "facebook", name: "Facebook" },
  { id: "line", name: "LINE" },
  { id: "threads", name: "Threads" },
  { id: "bluesky", name: "Bluesky" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "reddit", name: "Reddit" }
] as const

export type ShareTargetId = (typeof SHARE_TARGETS)[number]["id"]

/**
 * 共有先の投稿画面を開く URL を生成する。どれも新規タブで開くだけで、権限は要らない。
 * Facebook と LinkedIn は URL しか渡せない。投稿文は相手の画面でカードになる。
 */
export function buildShareTargetUrl(
  id: ShareTargetId,
  { message, storeUrl, hashtags }: { message: string; storeUrl: string; hashtags: string }
): string {
  const text = encodeURIComponent(buildShareText(message, storeUrl, hashtags))
  const url = encodeURIComponent(storeUrl)
  switch (id) {
    case "x":
      return `${X_INTENT_URL}?text=${text}`
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${url}&text=${encodeURIComponent(message)}`
    case "threads":
      return `https://www.threads.com/intent/post?text=${text}`
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${text}`
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    case "reddit":
      return `https://www.reddit.com/submit?url=${url}&title=${encodeURIComponent("Window & Viewport Resizer")}`
  }
}

/** X の投稿画面を開くURLを生成する（本文は URL エンコードされる）。 */
export function buildShareUrl(text: string): string {
  return `${X_INTENT_URL}?text=${encodeURIComponent(text)}`
}
