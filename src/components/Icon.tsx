import brandX from "data-text:../../icons/brand-x.svg"
import check from "data-text:../../icons/check.svg"
import copy from "data-text:../../icons/copy.svg"
import download from "data-text:../../icons/download.svg"
import screenshot from "data-text:../../icons/screenshot.svg"
import viewportTall from "data-text:../../icons/viewport-tall.svg"

/** Tabler Icons（outline, MIT License）。SVG は同梱ファイルをインライン展開する。 */
const ICONS = {
  screenshot,
  "viewport-tall": viewportTall,
  download,
  copy,
  check,
  "brand-x": brandX
} as const

export type IconName = keyof typeof ICONS

/**
 * SVG をインライン展開して表示する。色は stroke="currentColor" のため CSS の color で指定する。
 * 装飾用のため、読み上げ・フォーカス対象外（ラベルは親ボタンの title / aria-label で付与する）。
 */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <span
      className="icon"
      aria-hidden="true"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}
