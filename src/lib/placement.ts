/**
 * リサイズ後のウィンドウが画面からはみ出さない位置を求める。サイズは変えず、位置だけをずらす。
 *
 * 単体テスト（node）から読み込むので、このファイルでは `~lib` などの別名を import しない。
 */

/** 作業領域（タスクバーなどを除いた範囲）。screen.availLeft などと同じ座標系。 */
export interface WorkArea {
  left: number
  top: number
  width: number
  height: number
}

export interface WindowPosition {
  left: number
  top: number
}

/**
 * はみ出す分だけ動かした位置を返す。動かす必要がなければ null。
 *
 * 画面より大きいサイズは、拡張機能のアイコンがあるツールバーの右端と、ウィンドウの操作ボタンが
 * 触れるよう、幅は作業領域の右端に、高さは作業領域の上端に合わせる。こうするとウィンドウが画面を
 * 覆うので、Chrome の「面積の50%以上が画面内」という条件にも最も通りやすい。
 */
export function placeWindow(
  current: WindowPosition,
  size: { width: number; height: number },
  area: WorkArea
): WindowPosition | null {
  const right = area.left + area.width
  const bottom = area.top + area.height
  const left =
    size.width > area.width
      ? right - size.width
      : Math.max(area.left, Math.min(current.left, right - size.width))
  const top =
    size.height > area.height
      ? area.top
      : Math.max(area.top, Math.min(current.top, bottom - size.height))
  if (left === current.left && top === current.top) return null
  return { left, top }
}

/**
 * サイズがディスプレイを超えるか。幅と高さのどちらか片方でも超えたら超えたものとする
 * （画面外に出ると操作できなくなるので選ばせない）。ディスプレイが未取得（0）のときは超えないものとする。
 */
export function exceedsDisplay(
  size: { width: number; height: number },
  display: { width: number; height: number }
): boolean {
  if (display.width === 0 || display.height === 0) return false
  return size.width > display.width || size.height > display.height
}

/**
 * フォームの入力やボタンの強調に使う、今の基準のサイズ。
 * 最大化中のウィンドウは枠の分だけ画面より大きく報告されるので、ディスプレイのサイズを使う。
 */
export function resolveCurrentSize(
  mode: "window" | "viewport",
  sizes: {
    window: { width: number; height: number }
    viewport: { width: number; height: number }
    display: { width: number; height: number }
  },
  windowState?: string
): { width: number; height: number } {
  if (mode === "viewport") return sizes.viewport
  return windowState === "maximized" || windowState === "fullscreen"
    ? sizes.display
    : sizes.window
}
