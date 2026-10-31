/** picked: ページ上でユーザーが選んだスクロール範囲（目印付きの要素）を撮る。 */
export type CaptureMode = "visible" | "full-page" | "picked"

/**
 * download: 設定の形式で保存（受け付けた時点で応答し、結果はツールバーのバッジで知らせる）
 * copy: クリップボード用に PNG の data URL を返す。
 */
export type CaptureAction = "download" | "copy"

export interface CaptureRequest {
  type: "capture-screenshot"
  mode: CaptureMode
  /** 省略時は download。 */
  action?: CaptureAction
}

export interface CaptureResponse {
  ok: boolean
  error?: string
  downloadId?: number
  filename?: string
  /** action が copy の場合のみ。PNG の data URL。 */
  dataUrl?: string
}

export type BadgeKind = "busy" | "ok" | "error"

/** 送信元タブのツールバーアイコンにバッジを出す（範囲選択からのコピー結果の通知に使う）。 */
export interface BadgeRequest {
  type: "capture-badge"
  kind: BadgeKind
}

export type ExtensionMessage = CaptureRequest | BadgeRequest
