import { useI18n } from "~lib/i18n/useI18n"
import { formatOffset } from "~lib/offset"
import type { PresetGroup, PresetModeOffsets, SizeMode, SizePreset } from "~lib/types"

interface PresetGridProps {
  groups: PresetGroup[]
  offsets: Record<string, PresetModeOffsets>
  /** 現在選択中のモード。このモード用のオフセットだけをバッジ表示する。 */
  mode: SizeMode
  onSelect: (preset: SizePreset) => void
  disabled?: boolean
}

export function PresetGrid({ groups, offsets, mode, onSelect, disabled }: PresetGridProps) {
  const { t } = useI18n()
  return (
    <div className="preset-groups">
      {groups.map((group) => (
        <div key={group.id} className="preset-group">
          <p className="preset-group-title">{t(group.labelKey)}</p>
          <div className="preset-grid">
            {group.presets.map((preset) => {
              const offset = offsets[preset.id]?.[mode]
              return (
                <button
                  key={preset.id}
                  className="preset-button"
                  disabled={disabled}
                  onClick={() => onSelect(preset)}
                  title={`${preset.width} x ${preset.height}`}>
                  <span className="preset-label">{preset.label}</span>
                  {offset && (
                    <span className="preset-offset-badge">
                      {t("offsetBadge")}: {formatOffset(offset.offsetWidth, offset.offsetHeight)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

