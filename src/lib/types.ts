import type { MessageKey } from "./i18n/messages.en"

export type SizeMode = "window" | "viewport"

/** 表示言語の設定。auto はブラウザのUI言語に従う（日本語以外は英語）。 */
export type LanguageSetting = "auto" | "ja" | "en"

export interface SizePreset {
  id: string
  label: string
  width: number
  height: number
}

/** プリセットのグループ（アスペクト比別）。 */
export interface PresetGroup {
  id: string
  /** 表示名の翻訳キー（MessageKey）。 */
  labelKey: MessageKey
  presets: SizePreset[]
}

/** プリセットごとに保存されるオフセット（マージン）値。 */
export interface PresetOffset {
  offsetWidth: number
  offsetHeight: number
}

/**
 * プリセット1件あたりのモード別オフセット。
 * 「ウィンドウ基準」と「ビューポート基準」で必要な補正値が異なるため、個別に保持する。
 */
export type PresetModeOffsets = Partial<Record<SizeMode, PresetOffset>>

/**
 * カスタムサイズ。
 * offsetWidth / offsetHeight は「ウィンドウ基準」モード専用の補正値（px）。
 * OSやディスプレイのDPIスケーリング設定等により、chrome.windows.update に指定した
 * ウィンドウサイズと、OS側で実際に描画されるウィンドウ外枠実測サイズとの間に
 * 不可視のボーダー等によるズレが生じる場合、このオフセット値を加算して適用します。
 * テンプレート（SIZE_PRESETS）には常にオフセットは適用されません（0固定）。
 */
export interface CustomSize extends SizePreset {
  mode: SizeMode
  offsetWidth?: number
  offsetHeight?: number
}

export interface DisplayBounds {
  width: number
  height: number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

