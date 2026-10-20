export type CaptureMode = "visible" | "full-page"

/** download: 設定の形式で保存 / copy: クリップボード用に PNG の data URL を返す。 */
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

export type ExtensionMessage = CaptureRequest
