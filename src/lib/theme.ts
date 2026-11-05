import { getSettings } from "./storage"
import type { ThemeSetting } from "./types"

/** 表示前に当てるための控え。chrome.storage は非同期で、読む間にちらつくため localStorage にも持つ。 */
const THEME_CACHE_KEY = "theme"

/** 画面全体のテーマを切り替える。auto は属性を外し、CSS の prefers-color-scheme に任せる。 */
export function applyTheme(theme: ThemeSetting): void {
  if (theme === "auto") delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme)
  } catch {
    // 控えがなくても動く（少しちらつくだけ）
  }
}

/** popup・設定画面の読み込み時に呼ぶ。控えをすぐ当て、そのあと保存値で確定する。 */
export function initTheme(): void {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY)
    if (cached === "light" || cached === "dark") {
      document.documentElement.dataset.theme = cached
    }
  } catch {
    // 控えが読めなければ保存値を待つ
  }
  void getSettings().then((settings) => applyTheme(settings.theme))
}
