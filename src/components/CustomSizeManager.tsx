import { useEffect, useRef, useState } from "react"

import { useI18n } from "~lib/i18n/useI18n"
import type { CustomSize, DisplayBounds, SizeMode } from "~lib/types"
import { validateOffset, validateSize } from "~lib/resize"

interface CustomSizeManagerProps {
  mode: SizeMode
  display: DisplayBounds
  /** 今の基準での実際のサイズ（［今のサイズを入れる］で使う）。 */
  currentSize: DisplayBounds
  customSizes: CustomSize[]
  open: boolean
  editingSize: CustomSize | null
  onAdd: (size: CustomSize) => void
  onCancelEdit: () => void
}

/**
 * カスタムサイズの追加・変更フォーム。
 * 見出しと ＋（開閉）、一覧、適用、削除は CustomSizeList が担当する。
 * 編集開始（ペンアイコン押下）は親（popup.tsx）側で open を true にしてから
 * editingSize をセットする流れになる。
 */
export function CustomSizeManager({
  mode,
  display,
  currentSize,
  customSizes,
  open,
  editingSize,
  onAdd,
  onCancelEdit
}: CustomSizeManagerProps) {
  const { t } = useI18n()
  /** 名前の入力。null は未入力で、既定の名前を出す。 */
  const [label, setLabel] = useState<string | null>(null)
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [offsetWidth, setOffsetWidth] = useState("")
  const [offsetHeight, setOffsetHeight] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [syncedSize, setSyncedSize] = useState<CustomSize | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const editingId = editingSize?.id ?? null

  /** 使われていない最小の番号で既定の名前を作る（入力を省けるように、最初から入れておく）。 */
  function buildDefaultName(): string {
    const used = new Set(customSizes.map((s) => s.label))
    let n = 1
    while (used.has(t("customDefaultName", { n }))) n++
    return t("customDefaultName", { n })
  }
  const defaultName = buildDefaultName()

  function resetForm() {
    setLabel(null)
    setWidth("")
    setHeight("")
    setOffsetWidth("")
    setOffsetHeight("")
    setError(null)
  }

  // 編集対象が変わったら（ペンアイコン押下、または編集解除）フォーム内容を同期する。
  // effect ではなくレンダー中に同期し、余分な再レンダーを避ける。
  if (editingSize !== syncedSize) {
    setSyncedSize(editingSize)
    setLabel(editingSize?.label ?? null)
    setWidth(editingSize ? String(editingSize.width) : "")
    setHeight(editingSize ? String(editingSize.height) : "")
    setOffsetWidth(
      editingSize?.offsetWidth !== undefined ? String(editingSize.offsetWidth) : ""
    )
    setOffsetHeight(
      editingSize?.offsetHeight !== undefined ? String(editingSize.offsetHeight) : ""
    )
    setError(null)
  }

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
      label: (label ?? defaultName).trim() || defaultName,
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
      {open && (
        <div className="custom-size-panel" ref={panelRef}>
          <div className="custom-size-form">
            <p className="form-title">
              {editingId ? t("formTitleEdit") : t("formTitleAdd")}
            </p>
            <input
              className="text-input"
              placeholder={t("namePlaceholder")}
              value={label ?? defaultName}
              onFocus={(e) => e.target.select()}
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
              {editingId && (
                <button
                  type="button"
                  className="form-secondary-button"
                  onClick={onCancelEdit}
                >
                  {t("cancel")}
                </button>
              )}
              <button
                type="button"
                className="form-secondary-button"
                disabled={currentSize.width === 0}
                onClick={() => {
                  setWidth(String(currentSize.width))
                  setHeight(String(currentSize.height))
                  setError(null)
                }}
              >
                {t("useCurrentSize")}
              </button>
              <button type="button" className="primary-button" onClick={handleSubmit}>
                {editingId ? t("update") : t("add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
