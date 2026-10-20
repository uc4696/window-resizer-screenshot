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
export function buildShareText(message: string, storeUrl: string, hashtags: string): string {
  return `${message}\nWindow & Viewport Resizer${POINTING_DOWN}\n${storeUrl}\n${hashtags}`
}

/** X の投稿画面を開くURLを生成する（本文は URL エンコードされる）。 */
export function buildShareUrl(text: string): string {
  return `${X_INTENT_URL}?text=${encodeURIComponent(text)}`
}
