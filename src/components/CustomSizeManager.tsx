import { useEffect, useRef, useState } from "react"

import { useI18n } from "~lib/i18n/useI18n"
import type { CustomSize, DisplayBounds, SizeMode } from "~lib/types"
import { validateOffset, validateSize } from "~lib/resize"

interface CustomSizeManagerProps {
  mode: SizeMode
  display: DisplayBounds
  open: boolean
  editingSize: CustomSize | null
  onToggle: () => void
  onAdd: (size: CustomSize) => void
  onCancelEdit: () => void
}

/**
 * カスタムサイズの追加・変更フォーム（アコーディオン）。
 * 一覧表示・適用・削除は CustomSizeList（テンプレート直下）が担当し、
 * このコンポーネントは「追加・変更」フォームのみを扱う。
 * 編集開始（ペンアイコン押下）は親（popup.tsx）側で open を true にしてから
 * editingSize をセットする流れになる。
 */
export function CustomSizeManager({
  mode,
  display,
  open,
  editingSize,
  onToggle,
  onAdd,
  onCancelEdit
}: CustomSizeManagerProps) {
  const { t } = useI18n()
  const [label, setLabel] = useState("")
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [offsetWidth, setOffsetWidth] = useState("")
  const [offsetHeight, setOffsetHeight] = useState("")
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const editingId = editingSize?.id ?? null

  function resetForm() {
    setLabel("")
    setWidth("")
    setHeight("")
    setOffsetWidth("")
    setOffsetHeight("")
    setError(null)
  }

  // 編集対象が変わったら（ペンアイコン押下、または編集解除）フォーム内容を同期する。
  useEffect(() => {
    if (editingSize) {
      setLabel(editingSize.label)
      setWidth(String(editingSize.width))
      setHeight(String(editingSize.height))
      setOffsetWidth(editingSize.offsetWidth !== undefined ? String(editingSize.offsetWidth) : "")
      setOffsetHeight(
        editingSize.offsetHeight !== undefined ? String(editingSize.offsetHeight) : ""
      )
      setError(null)
    } else {
      resetForm()
    }
  }, [editingSize])

  // 編集開始でアコーディオンが開かれた際、フォームが表示範囲内に来るようスクロールする。
  useEffect(() => {
    if (open && editingSize) {
      panelRef.current?.scrollIntoView({ block: "nearest" })
    }
  }, [open, editingSize])

  function handleSubmit() {
    const w = Number(width)
    const h = Number(height)
    const sizeResult = validateSize(w, h, display)
    if (!sizeResult.valid) {
      setError(sizeResult.error ?? t("errInvalidInput"))
      return
    }

    let parsedOffsetW: number | undefined = undefined
    let parsedOffsetH: number | undefined = undefined

    if (mode === "window") {
      const offW = offsetWidth.trim() === "" ? 0 : Number(offsetWidth)
      const offH = offsetHeight.trim() === "" ? 0 : Number(offsetHeight)
      const offsetResult = validateOffset(offW, offH)
      if (!offsetResult.valid) {
        setError(offsetResult.error ?? t("errInvalidOffset"))
        return
      }
      if (offW !== 0 || offH !== 0) {
        parsedOffsetW = offW
        parsedOffsetH = offH
      }
    }

    const size: CustomSize = {
      id: editingId ?? `custom-${mode}-${Date.now()}`,
      label: label.trim() || `${w}x${h}`,
      width: w,
      height: h,
      mode,
      offsetWidth: parsedOffsetW,
      offsetHeight: parsedOffsetH
    }

    onAdd(size)
    resetForm()
  }

  return (
    <div className="custom-size-manager">
      <button
        type="button"
        className="link-button"
        onClick={() => {
          if (open) onCancelEdit()
          onToggle()
        }}>
        {open ? t("customToggleClose") : t("customToggleOpen")}
      </button>

      {open && (
        <div className="custom-size-panel" ref={panelRef}>
          <div className="custom-size-form">
            <p className="form-title">
              {editingId ? t("formTitleEdit") : t("formTitleAdd")}
            </p>
            <input
              className="text-input"
              placeholder={t("namePlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div className="wh-row">
              <input
                className="text-input wh-input"
                type="number"
                placeholder={t("widthPlaceholder")}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
              <span className="wh-sep">×</span>
              <input
                className="text-input wh-input"
                type="number"
                placeholder={t("heightPlaceholder")}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>

            {mode === "window" && (
              <div className="offset-section">
                <span className="offset-label">{t("offsetLabel")}</span>
                <div className="wh-row">
                  <input
                    className="text-input wh-input"
                    type="number"
                    placeholder={t("offsetWidthPlaceholder")}
                    value={offsetWidth}
                    onChange={(e) => setOffsetWidth(e.target.value)}
                  />
                  <span className="wh-sep">/</span>
                  <input
                    className="text-input wh-input"
                    type="number"
                    placeholder={t("offsetHeightPlaceholder")}
                    value={offsetHeight}
                    onChange={(e) => setOffsetHeight(e.target.value)}
                  />
                </div>
                <p className="hint-text">{t("offsetHint")}</p>
              </div>
            )}

            {error && <p className="error-text">{error}</p>}
            <p className="hint-text">
              {t("displayHint", { width: display.width, height: display.height })}
            </p>
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={handleSubmit}>
                {editingId ? t("update") : t("add")}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="secondary-cancel-button"
                  onClick={onCancelEdit}>
                  {t("cancel")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
