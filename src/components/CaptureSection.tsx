import { useEffect, useRef, useState } from "react"

import { Icon } from "~components/Icon"
import { useI18n } from "~lib/i18n/useI18n"
import type { CaptureAction, CaptureMode, CaptureResponse } from "~lib/messages"

/** コピー成功後、アイコンを check に切り替えておく時間（ms）。 */
export const COPIED_ICON_MS = 1500

interface Props {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (status: string | null) => void
}

function dataUrlToPngBlob(dataUrl: string): Blob {
  const base64 = dataUrl.split(",")[1] ?? ""
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: "image/png" })
}

/** background に撮影を依頼する。 */
function requestCapture(
  mode: CaptureMode,
  action: CaptureAction
): Promise<CaptureResponse> {
  return chrome.runtime.sendMessage({ type: "capture-screenshot", mode, action })
}

/**
 * スクリーンショット欄。「表示部分」「ページ全体」の2行で、
 * 左に範囲アイコン、右にダウンロード／コピーのアイコンボタンを並べる。
 */
export function CaptureSection({ busy, onBusyChange, onStatus }: Props) {
  const { t } = useI18n()
  const [copiedMode, setCopiedMode] = useState<CaptureMode | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const rows: {
    mode: CaptureMode
    icon: "screenshot" | "viewport-tall"
    label: string
    downloadLabel: string
    copyLabel: string
  }[] = [
    {
      mode: "visible",
      icon: "screenshot",
      label: t("captureVisibleLabel"),
      downloadLabel: t("captureVisibleDownload"),
      copyLabel: t("captureVisibleCopy")
    },
    {
      mode: "full-page",
      icon: "viewport-tall",
      label: t("captureFullPageLabel"),
      downloadLabel: t("captureFullPageDownload"),
      copyLabel: t("captureFullPageCopy")
    }
  ]

  function statusWhileCapturing(mode: CaptureMode): string {
    return mode === "full-page" ? t("statusCapturingFullPage") : t("statusCapturing")
  }

  async function handleDownload(mode: CaptureMode) {
    onBusyChange(true)
    onStatus(statusWhileCapturing(mode))
    try {
      const response = await requestCapture(mode, "download")
      if (response?.ok) {
        onStatus(t("statusSaved", { filename: response.filename ?? "" }))
      } else {
        onStatus(t("statusError", { message: response?.error ?? t("errCaptureFailed") }))
      }
    } catch (e) {
      onStatus(t("statusError", { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      onBusyChange(false)
    }
  }

  /**
   * クリップボードへ PNG をコピーする。
   * ClipboardItem に Promise を渡すことで、撮影に時間がかかる場合（ページ全体）でも
   * クリック直後に書き込みを開始でき、ユーザー操作の有効期限切れを避けられる。
   */
  async function handleCopy(mode: CaptureMode) {
    onBusyChange(true)
    onStatus(statusWhileCapturing(mode))
    try {
      const blobPromise = requestCapture(mode, "copy").then((response) => {
        if (!response?.ok || !response.dataUrl) {
          throw new Error(response?.error ?? t("errCaptureFailed"))
        }
        return dataUrlToPngBlob(response.dataUrl)
      })
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })])

      onStatus(t("statusCopied"))
      setCopiedMode(mode)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopiedMode(null), COPIED_ICON_MS)
    } catch (e) {
      const message = e instanceof Error ? e.message : t("errClipboard")
      onStatus(t("statusError", { message }))
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <section className="capture-section">
      <p className="section-title">{t("screenshotTitle")}</p>
      {rows.map((row) => (
        <div key={row.mode} className="capture-row" data-capture-mode={row.mode}>
          <span className="capture-scope" title={row.label}>
            <Icon name={row.icon} />
            <span className="capture-scope-label">{row.label}</span>
          </span>
          <div className="capture-actions">
            <button
              type="button"
              className="icon-button"
              title={row.downloadLabel}
              aria-label={row.downloadLabel}
              disabled={busy}
              onClick={() => handleDownload(row.mode)}
            >
              <Icon name="download" />
            </button>
            <button
              type="button"
              className={`icon-button ${copiedMode === row.mode ? "copied" : ""}`}
              title={row.copyLabel}
              aria-label={row.copyLabel}
              disabled={busy}
              onClick={() => handleCopy(row.mode)}
            >
              <Icon name={copiedMode === row.mode ? "check" : "copy"} />
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
