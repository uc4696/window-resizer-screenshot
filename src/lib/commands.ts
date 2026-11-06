/**
 * キーボードショートカット（manifest の commands）の名前と、その中身の対応。
 * manifest の commands は固定なので、増減するカスタムサイズは枠（1〜CUSTOM_SLOT_COUNT）で受ける。
 * どの枠にどのカスタムサイズを割り当てるかは、設定画面で選ぶ（Settings.customSizeSlots）。
 *
 * 単体テスト（node）から読み込むので、このファイルでは `~lib` などの別名を import しない。
 */
export const CUSTOM_SLOT_COUNT = 5

/** 遅延撮影の秒数（popup の選択肢とショートカットで共通）。 */
export const DELAY_SECONDS = [3, 5, 10]

/** package.json の manifest.commands と同じプリセット（constants.ts の id）。 */
const PRESET_IDS = ["hd", "wxga", "hdplus", "fhd", "vga", "svga", "xga", "uxga"]

export type ShortcutCommand =
  | { kind: "resize-preset"; presetId: string }
  | { kind: "resize-custom"; slot: number }
  | {
      kind: "capture"
      mode: "visible" | "full-page"
      action: "download" | "copy"
    }
  | { kind: "capture-delayed"; seconds: number }
  | { kind: "pick" }

const CAPTURE_COMMANDS: Record<string, ShortcutCommand> = {
  "capture-visible-download": { kind: "capture", mode: "visible", action: "download" },
  "capture-visible-copy": { kind: "capture", mode: "visible", action: "copy" },
  "capture-full-page-download": {
    kind: "capture",
    mode: "full-page",
    action: "download"
  },
  "capture-full-page-copy": { kind: "capture", mode: "full-page", action: "copy" },
  "capture-pick": { kind: "pick" },
  ...Object.fromEntries(
    DELAY_SECONDS.map((seconds) => [
      `capture-visible-delay-${seconds}`,
      { kind: "capture-delayed", seconds } as ShortcutCommand
    ])
  )
}

/** 設定画面に並べる順。 */
export const COMMAND_NAMES: string[] = [
  ...Object.keys(CAPTURE_COMMANDS),
  ...PRESET_IDS.map((id) => `resize-preset-${id}`),
  ...Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) => `resize-custom-${i + 1}`)
]

/** コマンド名を中身に変換する。知らない名前（_execute_action など）は null。 */
export function parseCommand(name: string): ShortcutCommand | null {
  if (!COMMAND_NAMES.includes(name)) return null
  if (name.startsWith("resize-preset-")) {
    return { kind: "resize-preset", presetId: name.slice("resize-preset-".length) }
  }
  if (name.startsWith("resize-custom-")) {
    return { kind: "resize-custom", slot: Number(name.slice("resize-custom-".length)) }
  }
  return CAPTURE_COMMANDS[name]
}

/** 保存値を枠の数にそろえる。不正な値は空（""）にする。 */
export function normalizeCustomSizeSlots(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: CUSTOM_SLOT_COUNT }, (_, i) =>
    typeof list[i] === "string" ? (list[i] as string) : ""
  )
}
