import { useEffect, useState } from "react"

import { CaptureSection } from "~components/CaptureSection"
import { CustomSizeList } from "~components/CustomSizeList"
import { CustomSizeManager } from "~components/CustomSizeManager"
import { Icon } from "~components/Icon"
import { PresetGrid } from "~components/PresetGrid"
import { ReviewPrompt } from "~components/ReviewPrompt"
import { ShareButton } from "~components/ShareButton"
import { SupportLink } from "~components/SupportLink"
import { PRESET_GROUPS } from "~lib/constants"
import { I18nProvider, useI18n } from "~lib/i18n/useI18n"
import {
  getActiveTabZoom,
  getCurrentDisplayBounds,
  getCurrentViewportSize,
  getCurrentWindowSize,
  isZoomed,
  resetTabZoom,
  resizeViewport,
  resizeWindow
} from "~lib/resize"
import { markReviewPromptOnUse } from "~lib/review-prompt"
import { initTheme } from "~lib/theme"
import {
  addCustomSize,
  getCustomSizes,
  getPresetOffsets,
  getSettings,
  getSizeMode,
  removeCustomSize,
  setSizeMode
} from "~lib/storage"
import type {
  CustomSize,
  DisplayBounds,
  PresetModeOffsets,
  SizeMode,
  SizePreset
} from "~lib/types"

import "./style.css"

initTheme()

/** 今のサイズの数字。× だけ細く小さくして、数字を読みやすくする。 */
function SizeValue({ size }: { size: DisplayBounds }) {
  return (
    <span className="size-value">
      {size.width}
      <span className="size-times">×</span>
      {size.height}
    </span>
  )
}

function PopupContent() {
  const { t } = useI18n()
  const [mode, setMode] = useState<SizeMode>("window")
  const [windowSize, setWindowSize] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [display, setDisplay] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [customSizes, setCustomSizes] = useState<CustomSize[]>([])
  const [presetOffsets, setPresetOffsets] = useState<Record<string, PresetModeOffsets>>(
    {}
  )
  const [status, setStatusText] = useState<string | null>(null)
  /** 見せずに読み上げだけにするメッセージか（リサイズの成功）。 */
  const [statusQuiet, setStatusQuiet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [editingCustomSizeId, setEditingCustomSizeId] = useState<string | null>(null)
  /** 拡大率を 100% に戻す確認を待っているリサイズ。 */
  const [zoomConfirm, setZoomConfirm] = useState<{
    preset: SizePreset | CustomSize
    tabId: number
    zoom: number
  } | null>(null)

  function setStatus(text: string | null, quiet = false) {
    setStatusText(text)
    setStatusQuiet(quiet)
  }

  async function refreshSizes() {
    const [w, v] = await Promise.all([getCurrentWindowSize(), getCurrentViewportSize()])
    setWindowSize(w)
    setViewportSize(v)
  }

  useEffect(() => {
    Promise.all([getCurrentWindowSize(), getCurrentViewportSize()]).then(([w, v]) => {
      setWindowSize(w)
      setViewportSize(v)
    })
    getCurrentDisplayBounds().then(setDisplay)
    getCustomSizes().then(setCustomSizes)
    getPresetOffsets().then(setPresetOffsets)
    // 最後に選択したサイズ基準を復元する
    getSizeMode().then(setMode)
  }, [])

  /** サイズ基準を切り替え、次回のポップアップ表示でも復元できるよう保存する。 */
  function changeMode(next: SizeMode) {
    setMode(next)
    setEditingCustomSizeId(null)
    void setSizeMode(next)
  }

  /**
   * プリセット・カスタムサイズの押下時。拡大率が 100% 以外のページでは
   * 意図しないサイズになるため、100% に戻してからリサイズする（既定は確認あり）。
   */
  async function requestApplySize(preset: SizePreset | CustomSize) {
    const [tabZoom, settings] = await Promise.all([getActiveTabZoom(), getSettings()])
    if (!tabZoom || !isZoomed(tabZoom.zoom)) {
      await applySize(preset)
      return
    }
    if (settings.zoomResetConfirm) {
      setZoomConfirm({ preset, tabId: tabZoom.tabId, zoom: tabZoom.zoom })
      return
    }
    await applySize(preset, tabZoom.tabId)
  }

  async function confirmZoomReset() {
    if (!zoomConfirm) return
    setZoomConfirm(null)
    await applySize(zoomConfirm.preset, zoomConfirm.tabId)
  }

  /** resetZoomTabId を渡すと、そのタブの拡大率を 100% に戻してからリサイズする。 */
  async function applySize(preset: SizePreset | CustomSize, resetZoomTabId?: number) {
    setBusy(true)
    setStatus(null)
    try {
      if (resetZoomTabId !== undefined) {
        await resetTabZoom(resetZoomTabId)
      }
      const custom = "mode" in preset ? (preset as CustomSize) : undefined
      const presetOffset = !custom ? presetOffsets[preset.id]?.[mode] : undefined
      const offW = custom?.offsetWidth ?? presetOffset?.offsetWidth ?? 0
      const offH = custom?.offsetHeight ?? presetOffset?.offsetHeight ?? 0

      if (mode === "window") {
        await resizeWindow(preset.width, preset.height, offW, offH)
      } else {
        await resizeViewport(preset.width + offW, preset.height + offH)
      }
      await refreshSizes()
      setStatus(t("statusResized", { width: preset.width, height: preset.height }), true)
      // 評価のお願いは、インストールから日がたってからの成功のときに印を付ける（次に開いたときに出す）
      void markReviewPromptOnUse().catch((error) =>
        console.warn("[review-prompt]", error)
      )
    } catch (e) {
      setStatus(t("statusError", { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddCustomSize(size: CustomSize) {
    const list = await addCustomSize(size)
    setCustomSizes(list)
    setEditingCustomSizeId(null)
  }

  async function handleRemoveCustomSize(id: string) {
    if (editingCustomSizeId === id) {
      setEditingCustomSizeId(null)
    }
    const list = await removeCustomSize(id)
    setCustomSizes(list)
  }

  /** ペンアイコン押下時：カスタムサイズ設定のアコーディオンを開いてから編集状態にする。 */
  function handleEditCustomSize(size: CustomSize) {
    setCustomSizeOpen(true)
    setEditingCustomSizeId(size.id)
  }

  function handleCancelEditCustomSize() {
    setEditingCustomSizeId(null)
  }

  return (
    <main className="popup-root">
      <h1 className="popup-title">Window &amp; Viewport Resizer</h1>

      <ReviewPrompt />

      {/* 今のサイズは見るだけ。押せる要素と区別するため、薄い背景だけで枠線を付けない */}
      <section className="current-size-section">
        <div className="size-item" title={t("currentWindowSize")}>
          <Icon name="app-window" size={15} />
          <SizeValue size={windowSize} />
        </div>
        <div className="size-item" title={t("currentViewportSize")}>
          <Icon name="viewport-wide" size={15} />
          <SizeValue size={viewportSize} />
        </div>
      </section>

      <div className="mode-toggle">
        <button
          className={`mode-button ${mode === "window" ? "active" : ""}`}
          aria-label={t("modeWindow")}
          title={t("modeWindowTitle")}
          onClick={() => changeMode("window")}
        >
          <Icon name="app-window" size={14} />
          <span>{t("modeWindowShort")}</span>
        </button>
        <button
          className={`mode-button ${mode === "viewport" ? "active" : ""}`}
          aria-label={t("modeViewport")}
          title={t("modeViewportTitle")}
          onClick={() => changeMode("viewport")}
        >
          <Icon name="viewport-wide" size={14} />
          <span>{t("modeViewportShort")}</span>
        </button>
      </div>

      <PresetGrid
        groups={PRESET_GROUPS}
        offsets={presetOffsets}
        mode={mode}
        onSelect={requestApplySize}
        disabled={busy}
      />

      <CustomSizeList
        mode={mode}
        customSizes={customSizes}
        editingId={editingCustomSizeId}
        onApply={requestApplySize}
        onEdit={handleEditCustomSize}
        onRemove={handleRemoveCustomSize}
      />

      <CustomSizeManager
        mode={mode}
        display={display}
        open={customSizeOpen}
        editingSize={customSizes.find((s) => s.id === editingCustomSizeId) ?? null}
        onToggle={() => setCustomSizeOpen((v) => !v)}
        onAdd={handleAddCustomSize}
        onCancelEdit={handleCancelEditCustomSize}
      />

      <CaptureSection busy={busy} onBusyChange={setBusy} onStatus={setStatus} />

      {/* 空のときは場所を取らない（エラーや撮影中のときだけ出る） */}
      <p
        className={`status-text ${statusQuiet ? "is-quiet" : ""}`}
        role="status"
        title={status ?? undefined}
      >
        {status}
      </p>

      <SupportLink />

      {/* 左に共有先（これから増やせる）、右に設定 */}
      <div className="popup-footer-row">
        <div className="footer-links">
          <ShareButton />
        </div>
        <button
          type="button"
          className="footer-icon-button options-link"
          title={t("openSettings")}
          aria-label={t("openSettings")}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <Icon name="settings" size={16} />
        </button>
      </div>

      {zoomConfirm && (
        <div className="zoom-confirm-overlay" role="dialog" aria-modal="true">
          <div className="zoom-confirm">
            <p className="zoom-confirm-message">
              {t("zoomConfirmMessage", { zoom: Math.round(zoomConfirm.zoom * 100) })}
            </p>
            <div className="zoom-confirm-actions">
              <button
                type="button"
                className="zoom-confirm-cancel"
                onClick={() => setZoomConfirm(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="zoom-confirm-ok"
                autoFocus
                onClick={confirmZoomReset}
              >
                {t("zoomConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function IndexPopup() {
  return (
    <I18nProvider>
      <PopupContent />
    </I18nProvider>
  )
}

export default IndexPopup
