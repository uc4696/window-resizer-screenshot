export type CaptureMode = "visible" | "full-page"

export interface CaptureRequest {
  type: "capture-screenshot"
  mode: CaptureMode
}

export interface CaptureResponse {
  ok: boolean
  error?: string
  downloadId?: number
  filename?: string
}

export type ExtensionMessage = CaptureRequest
