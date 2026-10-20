import brandX from "data-text:../../icons/brand-x.svg"
import check from "data-text:../../icons/check.svg"
import copy from "data-text:../../icons/copy.svg"
import download from "data-text:../../icons/download.svg"
import screenshot from "data-text:../../icons/screenshot.svg"
import settings from "data-text:../../icons/settings.svg"
import viewportTall from "data-text:../../icons/viewport-tall.svg"

/**
 * Tabler Icons（MIT License）。SVG は同梱ファイルをインライン展開する。
 * SVG 内の class="icon ..." はラッパー（.ui-icon）のスタイルと衝突して
 * サイズ崩れ・見切れの原因になるため、読み込み時に除去する。
 */
const stripClass = (svg: string): string => svg.replace(/\sclass="[^"]*"/, "")

const ICONS = {
  screenshot: stripClass(screenshot),
  "viewport-tall": stripClass(viewportTall),
  download: stripClass(download),
  copy: stripClass(copy),
  check: stripClass(check),
  "brand-x": stripClass(brandX),
  settings: stripClass(settings)
} as const

export type IconName = keyof typeof ICONS

/**
 * SVG をインライン展開して表示する。色は currentColor のため CSS の color で指定する。
 * 装飾用のため、読み上げ・フォーカス対象外（ラベルは親ボタンの title / aria-label で付与する）。
 */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  // Plasmo のビルド（SVG 最適化）で viewBox が除去されるため、ここで 24x24 の viewBox を補う。
  // viewBox がないと width / height を変えても縮小されず、枠からはみ出して一部しか見えなくなる。
  const html = ICONS[name]
    .replace(/\swidth="[^"]*"/, ` width="${size}"`)
    .replace(/\sheight="[^"]*"/, ` height="${size}"`)
    .replace(/<svg(?![^>]*\sviewBox=)/, '<svg viewBox="0 0 24 24"')
  return (
    <span
      className="ui-icon"
      aria-hidden="true"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
