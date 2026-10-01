import { getSettings } from "../storage"
import type { LanguageSetting } from "../types"
import { en, type MessageKey } from "./messages.en"
import { ja } from "./messages.ja"

export type { MessageKey }
export type ResolvedLanguage = "ja" | "en"

/** 言語選択肢に表示する各言語の自称（翻訳しない）。 */
export const LANGUAGE_NATIVE_NAMES: Record<ResolvedLanguage, string> = {
  ja: "日本語",
  en: "English"
}

const dictionaries: Record<ResolvedLanguage, Record<MessageKey, string>> = { en, ja }

/** 「自動」の場合はブラウザのUI言語で判定する（日本語以外はすべて英語）。 */
export function resolveLanguage(setting: LanguageSetting): ResolvedLanguage {
  if (setting === "ja" || setting === "en") return setting
  let uiLanguage = ""
  try {
    uiLanguage = chrome.i18n?.getUILanguage?.() ?? navigator.language ?? ""
  } catch {
    uiLanguage = navigator.language ?? ""
  }
  return uiLanguage.toLowerCase().startsWith("ja") ? "ja" : "en"
}

let currentLanguage: ResolvedLanguage = resolveLanguage("auto")
const listeners = new Set<() => void>()

export function getLanguage(): ResolvedLanguage {
  return currentLanguage
}

/** 言語設定を反映し、購読中のコンポーネントへ通知する。 */
export function setLanguage(setting: LanguageSetting): void {
  const next = resolveLanguage(setting)
  if (next === currentLanguage) return
  currentLanguage = next
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** ストレージに保存された言語設定を読み込んで反映する。 */
export async function initI18n(): Promise<void> {
  try {
    const settings = await getSettings()
    setLanguage(settings.language)
  } catch {
    // 読み込めない場合は現在の言語（ブラウザ言語ベース）のまま動作する
  }
}

/** メッセージを取得する。{name} 形式のプレースホルダーを params で置換する。 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionaries[currentLanguage][key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}
