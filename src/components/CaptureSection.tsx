import { useEffect, useRef, useState } from "react"

import { Icon } from "~components/Icon"
import { useI18n } from "~lib/i18n/useI18n"
import type { CaptureAction, CaptureMode, CaptureResponse } from "~lib/messages"
import { countPickCandidates, startPicker } from "~lib/picker"

/** コピー成功後、check アイコンを見せてから popup を閉じるまでの時間（ms）。 */
export const CLOSE_AFTER_COPY_MS = 800

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
 * 「ページ全体」の行には、スクロール範囲を選んで撮る［選択］ボタンも置く
 * （選べる範囲があるページでだけ押せる）。
 */
export function CaptureSection({ busy, onBusyChange, onStatus }: Props) {
  const { t } = useI18n()
  const [copiedMode, setCopiedMode] = useState<CaptureMode | null>(null)
  const [pickTabId, setPickTabId] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // 対象タブに選べるスクロール範囲があるか調べ、あれば［選択］を有効にする
  useEffect(() => {
    let cancelled = false
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (tab?.id === undefined) return
        const count = await countPickCandidates(tab.id)
        if (!cancelled && count > 0) setPickTabId(tab.id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  /** ページ上で範囲を選ぶ UI を開始し、popup を閉じる（以降はページ側で保存／コピーを選ぶ）。 */
  async function handlePick() {
    if (pickTabId === null) return
    try {
      await startPicker(pickTabId, {
        banner: t("pickerBanner"),
        content: t("pickerContent"),
        save: t("pickerSave"),
        copy: t("pickerCopy"),
        cancel: t("pickerCancel")
      })
      window.close()
    } catch (e) {
      onStatus(t("statusError", { message: e instanceof Error ? e.message : String(e) }))
    }
  }

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

  /**
   * 保存は background に任せ、受け付けられたら popup を閉じる。
   * 撮影・保存の結果はツールバーアイコンのバッジ（OK / !）で知らせる。
   */
  async function handleDownload(mode: CaptureMode) {
    onBusyChange(true)
    onStatus(statusWhileCapturing(mode))
    try {
      const response = await requestCapture(mode, "download")
      if (response?.ok) {
        window.close()
        return
      }
      onStatus(t("statusError", { message: response?.error ?? t("errCaptureFailed") }))
    } catch (e) {
      onStatus(t("statusError", { message: e instanceof Error ? e.message : String(e) }))
    }
    onBusyChange(false)
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

      // 完了を check アイコンで少し見せてから popup を閉じる
      onStatus(t("statusCopied"))
      setCopiedMode(mode)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => window.close(), CLOSE_AFTER_COPY_MS)
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
            {row.mode === "full-page" && (
              <button
                type="button"
                className="icon-button"
                title={
                  pickTabId !== null ? t("capturePick") : t("capturePickUnavailable")
                }
                aria-label={t("capturePick")}
                disabled={busy || pickTabId === null}
                onClick={handlePick}
              >
                <Icon name="click" />
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
