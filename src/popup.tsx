import { useEffect, useState } from "react"

import { CaptureSection } from "~components/CaptureSection"
import { CustomSizeList } from "~components/CustomSizeList"
import { CustomSizeManager } from "~components/CustomSizeManager"
import { Icon } from "~components/Icon"
import { PresetGrid } from "~components/PresetGrid"
import { ShareButton } from "~components/ShareButton"
import { SupportLink } from "~components/SupportLink"
import { PRESET_GROUPS } from "~lib/constants"
import { I18nProvider, useI18n } from "~lib/i18n/useI18n"
import {
  getCurrentDisplayBounds,
  getCurrentViewportSize,
  getCurrentWindowSize,
  resizeViewport,
  resizeWindow
} from "~lib/resize"
import {
  addCustomSize,
  getCustomSizes,
  getPresetOffsets,
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

function PopupContent() {
  const { t } = useI18n()
  const [mode, setMode] = useState<SizeMode>("window")
  const [windowSize, setWindowSize] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [display, setDisplay] = useState<DisplayBounds>({ width: 0, height: 0 })
  const [customSizes, setCustomSizes] = useState<CustomSize[]>([])
  const [presetOffsets, setPresetOffsets] = useState<Record<string, PresetModeOffsets>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [editingCustomSizeId, setEditingCustomSizeId] = useState<string | null>(null)

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

  async function applySize(preset: SizePreset | CustomSize) {
    setBusy(true)
    setStatus(null)
    try {
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
      setStatus(t("statusResized", { width: preset.width, height: preset.height }))
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

      <section className="current-size-section">
        <div className="size-row">
          <span className="size-label">{t("windowLabel")}</span>
          <span className="size-value">
            {windowSize.width} x {windowSize.height}
          </span>
        </div>
        <div className="size-row">
          <span className="size-label">{t("viewportLabel")}</span>
          <span className="size-value">
            {viewportSize.width} x {viewportSize.height}
          </span>
        </div>
      </section>

      <div className="mode-toggle">
        <button
          className={`mode-button ${mode === "window" ? "active" : ""}`}
          onClick={() => changeMode("window")}>
          {t("modeWindow")}
        </button>
        <button
          className={`mode-button ${mode === "viewport" ? "active" : ""}`}
          onClick={() => changeMode("viewport")}>
          {t("modeViewport")}
        </button>
      </div>

      <PresetGrid
        groups={PRESET_GROUPS}
        offsets={presetOffsets}
        mode={mode}
        onSelect={applySize}
        disabled={busy}
      />

      <CustomSizeList
        mode={mode}
        customSizes={customSizes}
        editingId={editingCustomSizeId}
        onApply={applySize}
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

      {/* ステータス表示は常に1行分の高さを確保し、表示時にレイアウトが跳ねないようにする */}
      <p className="status-text" title={status ?? undefined}>
        {status}
      </p>

      <div className="popup-footer-row">
        <button
          type="button"
          className="footer-button options-link"
          onClick={() => chrome.runtime.openOptionsPage()}>
          <Icon name="settings" size={12} />
          <span>{t("openSettings")}</span>
        </button>
        <ShareButton />
      </div>

      <SupportLink />
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

