import { Icon } from "~components/Icon"
import { useI18n } from "~lib/i18n/useI18n"
import { formatOffset } from "~lib/offset"
import { exceedsDisplay } from "~lib/placement"
import type { CustomSize, DisplayBounds, SizeMode } from "~lib/types"

interface CustomSizeListProps {
  mode: SizeMode
  customSizes: CustomSize[]
  /** 今の基準での実際のサイズ。同じサイズの行を強調する。 */
  currentSize: DisplayBounds
  /** ディスプレイのサイズ。別のモニターや同期で登録した、超えるサイズは押せない。 */
  display: DisplayBounds
  editingId: string | null
  formOpen: boolean
  onToggleForm: () => void
  onApply: (size: CustomSize) => void
  onEdit: (size: CustomSize) => void
  onRemove: (id: string) => void
}

/**
 * カスタムサイズの見出しと一覧（適用・編集・削除）。
 * 見出しの右の ＋ で追加のフォームを開閉するので、登録が0件でも見出しは出す。
 * 各行には名前とサイズを出し、オフセットはツールチップに出す。
 */
export function CustomSizeList({
  mode,
  customSizes,
  currentSize,
  display,
  editingId,
  formOpen,
  onToggleForm,
  onApply,
  onEdit,
  onRemove
}: CustomSizeListProps) {
  const { t } = useI18n()
  const filtered = customSizes.filter((s) => s.mode === mode)
  const toggleLabel = formOpen ? t("customToggleClose") : t("customToggleOpen")

  return (
    <div className="custom-size-section">
      <div className="custom-size-header">
        <p className="preset-group-title">
          <Icon name="adjustments-horizontal" size={14} />
          <span>{t("customSizes")}</span>
        </p>
        <button
          type="button"
          className="custom-size-toggle"
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={formOpen}
          onClick={onToggleForm}
        >
          <Icon name={formOpen ? "x" : "plus"} size={14} />
        </button>
      </div>
      {filtered.length > 0 && (
        <div className="custom-size-list">
          {filtered.map((size) => {
            const offW = size.offsetWidth ?? 0
            const offH = size.offsetHeight ?? 0
            const hasOffset =
              size.mode === "window" &&
              (size.offsetWidth !== undefined || size.offsetHeight !== undefined)
            const isCurrent =
              size.width + offW === currentSize.width &&
              size.height + offH === currentSize.height
            const over = exceedsDisplay(size, display)
            const title = [
              `${size.label} (${size.width} x ${size.height})`,
              hasOffset ? `${t("offsetBadge")}: ${formatOffset(offW, offH)}` : null,
              over ? t("sizeOverDisplay", { ...display }) : null
            ]
              .filter(Boolean)
              .join("\n")
            return (
              <div
                className={`custom-size-row ${editingId === size.id ? "is-editing" : ""}`}
                key={size.id}
              >
                <button
                  className={`custom-size-apply ${isCurrent ? "is-current" : ""}`}
                  aria-current={isCurrent ? "true" : undefined}
                  disabled={over}
                  onClick={() => onApply(size)}
                  title={title}
                >
                  <span className="custom-size-name">{size.label}</span>
                  <span className="custom-size-dimensions">
                    {size.width}×{size.height}
                  </span>
                </button>
                <button
                  className="custom-size-edit"
                  aria-label={t("edit")}
                  title={t("edit")}
                  onClick={() => onEdit(size)}
                >
                  ✎
                </button>
                <button
                  className="custom-size-remove"
                  aria-label={t("delete")}
                  title={t("delete")}
                  onClick={() => onRemove(size.id)}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
