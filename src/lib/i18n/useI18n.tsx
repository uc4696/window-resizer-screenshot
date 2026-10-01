import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"

import { getLanguage, initI18n, subscribe, t } from "./index"

/** 言語が切り替わると再レンダリングされるフック。 */
export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage)
  return { t, language }
}

/** 保存済みの言語設定を読み込んでから子要素を描画する（初回表示のちらつき防止）。 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initI18n().finally(() => setReady(true))
  }, [])

  if (!ready) return null
  return <>{children}</>
}
