import { useI18n } from "~lib/i18n/useI18n"
import { formatOffset } from "~lib/offset"
import type { CustomSize, SizeMode } from "~lib/types"

interface CustomSizeListProps {
  mode: SizeMode
  customSizes: CustomSize[]
  editingId: string | null
  onApply: (size: CustomSize) => void
  onEdit: (size: CustomSize) => void
  onRemove: (id: string) => void
}

/**
 * 保存済みのカスタムサイズ一覧（適用・編集・削除）。
 * テンプレート（PresetGrid）の直下に常時表示し、
 * 「カスタムサイズの設定」アコーディオンを開かずに素早く適用できるようにする。
 * 該当モードの登録が0件の場合はセクションごと非表示にする。
 */
export function CustomSizeList({
  mode,
  customSizes,
  editingId,
  onApply,
  onEdit,
  onRemove
}: CustomSizeListProps) {
  const { t } = useI18n()
  const filtered = customSizes.filter((s) => s.mode === mode)

  if (filtered.length === 0) {
    return null
  }

  return (
    <div className="custom-size-section">
      <p className="preset-group-title">{t("customSizes")}</p>
      <div className="custom-size-list">
        {filtered.map((size) => {
          const hasOffset =
            size.mode === "window" &&
            (size.offsetWidth !== undefined || size.offsetHeight !== undefined)
          const offW = size.offsetWidth ?? 0
          const offH = size.offsetHeight ?? 0
          return (
            <div
              className={`custom-size-row ${editingId === size.id ? "is-editing" : ""}`}
              key={size.id}>
              <button
                className="custom-size-apply"
                onClick={() => onApply(size)}
                title={`${size.width} x ${size.height}${
                  hasOffset
                    ? ` (${t("offsetBadge")}: ${formatOffset(offW, offH)})`
                    : ""
                }`}>
                <span className="custom-size-name">{size.label}</span>
                {hasOffset && (
                  <span className="offset-badge" title={t("offsetBadgeTitle")}>
                    {t("offsetBadge")}: {formatOffset(offW, offH)}
                  </span>
                )}
              </button>
              <button
                className="custom-size-edit"
                aria-label={t("edit")}
                title={t("edit")}
                onClick={() => onEdit(size)}>
                ✎
              </button>
              <button
                className="custom-size-remove"
                aria-label={t("delete")}
                title={t("delete")}
                onClick={() => onRemove(size.id)}>
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
