/** オフセット値を符号付き文字列（例: "+10,+5" / "-3,+0"）に整形する。 */
export function formatOffset(w: number, h: number): string {
  const sign = (n: number) => (n >= 0 ? "+" : "")
  return `${sign(w)}${w},${sign(h)}${h}`
}
