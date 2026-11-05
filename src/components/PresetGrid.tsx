import { Icon, type IconName } from "~components/Icon"
import { useI18n } from "~lib/i18n/useI18n"
import { formatOffset } from "~lib/offset"
import type {
  DisplayBounds,
  PresetGroup,
  PresetModeOffsets,
  SizeMode,
  SizePreset
} from "~lib/types"

interface PresetGridProps {
  groups: PresetGroup[]
  offsets: Record<string, PresetModeOffsets>
  /** 現在選択中のモード。このモード用のオフセットだけをバッジ表示する。 */
  mode: SizeMode
  /** 今の基準での実際のサイズ。同じサイズのプリセットを強調する。 */
  currentSize: DisplayBounds
  onSelect: (preset: SizePreset) => void
  disabled?: boolean
}

/** アスペクト比ごとの見出しのアイコン。 */
const GROUP_ICONS: Record<string, IconName> = {
  "16-9": "ratio-16-9",
  "4-3": "ratio-4-3"
}

/** プリセットのアイコン。どの比率も同じ大きさの面に、短い名前（720p など）を書く。 */
function PresetScreen({ text }: { text: string }) {
  return (
    <svg
      className="preset-screen"
      viewBox="0 0 65 30"
      width="100%"
      height={30}
      aria-hidden="true"
    >
      <rect width={65} height={30} />
      <text x={32.5} y={15} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </svg>
  )
}

export function PresetGrid({
  groups,
  offsets,
  mode,
  currentSize,
  onSelect,
  disabled
}: PresetGridProps) {
  const { t } = useI18n()
  return (
    <div className="preset-groups">
      {groups.map((group) => {
        return (
          <div key={group.id} className="preset-group">
            <p className="preset-group-title">
              <Icon name={GROUP_ICONS[group.id]} size={14} />
              <span>{t(group.labelKey)}</span>
            </p>
            <div className="preset-grid">
              {group.presets.map((preset) => {
                const offset = offsets[preset.id]?.[mode]
                const offsetText =
                  offset &&
                  `${t("offsetBadge")}: ${formatOffset(offset.offsetWidth, offset.offsetHeight)}`
                const isCurrent =
                  preset.width + (offset?.offsetWidth ?? 0) === currentSize.width &&
                  preset.height + (offset?.offsetHeight ?? 0) === currentSize.height
                const title = offsetText ? `${preset.label}\n${offsetText}` : preset.label
                return (
                  <button
                    key={preset.id}
                    className={`preset-button ${isCurrent ? "is-current" : ""}`}
                    aria-current={isCurrent ? "true" : undefined}
                    data-size={`${preset.width}x${preset.height}`}
                    disabled={disabled}
                    onClick={() => onSelect(preset)}
                    title={title}
                    aria-label={title}
                  >
                    <PresetScreen text={preset.short ?? preset.label} />
                    {/* 補正の値はツールチップに出し、ここでは補正があることだけを示す */}
                    {offset && <span className="preset-offset-badge" />}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
