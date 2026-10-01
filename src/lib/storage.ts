import { Storage } from "@plasmohq/storage"

import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants"
import type {
  CustomSize,
  LanguageSetting,
  PresetModeOffsets,
  PresetOffset,
  SizeMode
} from "./types"

export interface Settings {
  captureDirName: string
  storageArea: "local" | "sync"
  language: LanguageSetting
}

/**
 * 設定（Captureフォルダ名、storageAreaの選択そのもの）は常に local に保存する。
 * これにより「sync を選んだ」という設定自体は端末ローカルに固定され、
 * 実際のデータ（カスタムサイズ）だけを選択された area に保存できる。
 */
const settingsStorage = new Storage({ area: "local" })

/** カスタムサイズ保存用。area は動的に切り替える。 */
let dataStorage = new Storage({ area: DEFAULT_SETTINGS.storageArea })
let currentArea: "local" | "sync" = DEFAULT_SETTINGS.storageArea

function getDataStorage(area: "local" | "sync") {
  if (area !== currentArea) {
    currentArea = area
    dataStorage = new Storage({ area })
  }
  return dataStorage
}

export async function getSettings(): Promise<Settings> {
  const raw = await settingsStorage.get<Settings>(STORAGE_KEYS.settings)
  return {
    captureDirName: raw?.captureDirName || DEFAULT_SETTINGS.captureDirName,
    storageArea: raw?.storageArea || DEFAULT_SETTINGS.storageArea,
    language: raw?.language || DEFAULT_SETTINGS.language
  }
}

export async function setSettings(settings: Settings): Promise<void> {
  await settingsStorage.set(STORAGE_KEYS.settings, settings)
}

export async function getCustomSizes(): Promise<CustomSize[]> {
  const settings = await getSettings()
  const storage = getDataStorage(settings.storageArea)
  const list = await storage.get<CustomSize[]>(STORAGE_KEYS.customSizes)
  return list || []
}

export async function saveCustomSizes(list: CustomSize[]): Promise<void> {
  const settings = await getSettings()
  const storage = getDataStorage(settings.storageArea)
  await storage.set(STORAGE_KEYS.customSizes, list)
}

export async function addCustomSize(size: CustomSize): Promise<CustomSize[]> {
  const list = await getCustomSizes()
  const next = [...list.filter((s) => s.id !== size.id), size]
  await saveCustomSizes(next)
  return next
}

export async function removeCustomSize(id: string): Promise<CustomSize[]> {
  const list = await getCustomSizes()
  const next = list.filter((s) => s.id !== id)
  await saveCustomSizes(next)
  return next
}

/**
 * プリセットテンプレートごとのオフセット（マージン）設定を取得する。
 * 設定自体は常に local に保存される（storageArea の対象外）。
 */
export async function getPresetOffsets(): Promise<Record<string, PresetModeOffsets>> {
  const raw = await settingsStorage.get<Record<string, unknown>>(STORAGE_KEYS.presetOffsets)
  const result: Record<string, PresetModeOffsets> = {}
  for (const [id, value] of Object.entries(raw || {})) {
    const v = value as Partial<PresetOffset> & PresetModeOffsets
    if (typeof v?.offsetWidth === "number" && typeof v?.offsetHeight === "number") {
      // 旧形式（モード共通）のデータは、両モードに同じ値を引き継ぐ
      const legacy = { offsetWidth: v.offsetWidth, offsetHeight: v.offsetHeight }
      result[id] = { window: { ...legacy }, viewport: { ...legacy } }
    } else if (v && (v.window || v.viewport)) {
      result[id] = { window: v.window, viewport: v.viewport }
    }
  }
  return result
}

export async function setPresetOffset(
  presetId: string,
  mode: SizeMode,
  offset: PresetOffset
): Promise<Record<string, PresetModeOffsets>> {
  const current = await getPresetOffsets()
  const next = { ...current, [presetId]: { ...current[presetId], [mode]: offset } }
  await settingsStorage.set(STORAGE_KEYS.presetOffsets, next)
  return next
}

export async function removePresetOffset(
  presetId: string,
  mode: SizeMode
): Promise<Record<string, PresetModeOffsets>> {
  const current = await getPresetOffsets()
  const next = { ...current }
  const entry = { ...next[presetId] }
  delete entry[mode]
  if (entry.window || entry.viewport) {
    next[presetId] = entry
  } else {
    delete next[presetId]
  }
  await settingsStorage.set(STORAGE_KEYS.presetOffsets, next)
  return next
}

/**
 * アプリケーションの設定値をすべて初期状態に戻す（ファクトリーリセット）。
 * settings / カスタムサイズ / プリセットオフセットを local・sync 両方から削除し、
 * 既定値を再書き込みする。
 */
export async function resetAllSettings(): Promise<void> {
  await settingsStorage.removeMany([STORAGE_KEYS.settings, STORAGE_KEYS.presetOffsets])

  const localStorage = getDataStorage("local")
  const syncStorage = getDataStorage("sync")
  await Promise.all([
    localStorage.removeItem(STORAGE_KEYS.customSizes),
    syncStorage.removeItem(STORAGE_KEYS.customSizes)
  ])

  await settingsStorage.set(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  currentArea = DEFAULT_SETTINGS.storageArea
  dataStorage = new Storage({ area: DEFAULT_SETTINGS.storageArea })
}

/**
 * storageArea 切り替え時、既存のカスタムサイズを新しい area にも複製する
 * （データの引っ越し）。設定自体は常に local に保存されるため、
 * この関数呼び出し前後で getSettings() の値は呼び出し側で更新すること。
 */
export async function migrateCustomSizes(
  fromArea: "local" | "sync",
  toArea: "local" | "sync"
): Promise<void> {
  if (fromArea === toArea) return
  const fromStorage = getDataStorage(fromArea)
  const list = await fromStorage.get<CustomSize[]>(STORAGE_KEYS.customSizes)
  if (list && list.length > 0) {
    const toStorage = getDataStorage(toArea)
    await toStorage.set(STORAGE_KEYS.customSizes, list)
  }
}
