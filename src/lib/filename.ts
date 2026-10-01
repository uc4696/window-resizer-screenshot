/**
 * "screenshot_YYYYMMDD_HHMISS.jpg" 形式のファイル名を生成する。
 */
export function buildScreenshotFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `screenshot_${y}${m}${d}_${hh}${mm}${ss}.jpg`
}

/**
 * ダウンロード先パスを組み立てる（Captures/screenshot_....jpg 形式）。
 * chrome.downloads.download の filename はダウンロードディレクトリからの相対パス。
 */
export function buildDownloadPath(captureDirName: string, filename: string): string {
  const safeDir = captureDirName.trim() || "Captures"
  return `${safeDir}/${filename}`
}
