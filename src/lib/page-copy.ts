import type { CaptureMode } from "./messages"

/**
 * ページに注入して実行する、ショートカットからのコピー。外部を参照せず、この中だけで完結させる。
 * clipboardWrite 権限を使わないため、ショートカットの押下で付いたページのユーザー操作の間に
 * 書き込みを始め、画像は Promise で渡す（撮影に時間がかかっても有効期限が切れない）。
 * 結果は capture-badge メッセージでバッジに出す。クリップボード API が使えないページでは false を返す。
 */
function copyCaptureInPage(mode: CaptureMode): boolean {
  if (
    !window.isSecureContext ||
    !navigator.clipboard ||
    typeof ClipboardItem === "undefined"
  ) {
    return false
  }
  const blob = chrome.runtime
    .sendMessage({ type: "capture-screenshot", mode, action: "copy" })
    .then((response: { ok: boolean; error?: string; dataUrl?: string }) => {
      if (!response?.ok || !response.dataUrl) {
        throw new Error(response?.error ?? "capture failed")
      }
      const binary = atob(response.dataUrl.split(",")[1] ?? "")
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: "image/png" })
    })
  navigator.clipboard
    .write([new ClipboardItem({ "image/png": blob })])
    .then(
      () => chrome.runtime.sendMessage({ type: "capture-badge", kind: "ok" }),
      (error) => {
        console.error("[window-resizer-screenshot]", error)
        return chrome.runtime.sendMessage({ type: "capture-badge", kind: "error" })
      }
    )
    .catch(() => undefined)
  return true
}

/** 対象タブでコピーを始める。クリップボード API が使えないページでは false を返す。 */
export async function startCopyInPage(
  tabId: number,
  mode: CaptureMode
): Promise<boolean> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: copyCaptureInPage,
    args: [mode]
  })
  return result === true
}
