import type { PresetGroup, SizePreset } from "./types"

/**
 * 解像度テンプレート（プリセット）。アスペクト比ごとにグループ化されている。
 * ウィンドウ基準の場合はウィンドウサイズに、
 * ビューポート基準の場合はビューポートサイズにそのまま適用される
 * （個別に設定されたオフセットがある場合はそれを加算する）。
 */
export const PRESET_GROUPS: PresetGroup[] = [
  {
    id: "16-9",
    labelKey: "presetGroup169",
    presets: [
      { id: "hd", label: "HD (1280×720)", width: 1280, height: 720 },
      { id: "fhd", label: "FHD (1920×1080)", width: 1920, height: 1080 },
      { id: "wqhd", label: "WQHD (2560×1440)", width: 2560, height: 1440 },
      { id: "4k", label: "4K (3840×2160)", width: 3840, height: 2160 }
    ]
  },
  {
    id: "4-3",
    labelKey: "presetGroup43",
    presets: [
      { id: "vga", label: "VGA (640×480)", width: 640, height: 480 },
      { id: "svga", label: "SVGA (800×600)", width: 800, height: 600 },
      { id: "xga", label: "XGA (1024×768)", width: 1024, height: 768 },
      { id: "uxga", label: "UXGA (1600×1200)", width: 1600, height: 1200 }
    ]
  }
]

/** すべてのプリセットをフラットな配列で取得する。 */
export const SIZE_PRESETS: SizePreset[] = PRESET_GROUPS.flatMap((g) => g.presets)

/** カスタムサイズの現実的な最小値・最大値（px） */
export const MIN_SIZE = 200
export const MAX_SIZE_FALLBACK = 4096

/** ストレージキー */
export const STORAGE_KEYS = {
  customSizes: "custom-sizes",
  settings: "settings",
  presetOffsets: "preset-offsets"
} as const

/** 既定の設定値 */
export const DEFAULT_SETTINGS = {
  captureDirName: "Captures",
  storageArea: "local" as "local" | "sync",
  language: "auto" as "auto" | "ja" | "en"
}

