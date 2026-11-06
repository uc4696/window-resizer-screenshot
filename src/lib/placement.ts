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
 * ビューポート基準はウィンドウの枠（frame）の分も足して比べる。ウィンドウの高さは画面の大きさで
 * 頭打ちになり、画面より少し小さいビューポートも作れないため。
 */
export function exceedsDisplay(
  size: { width: number; height: number },
  display: { width: number; height: number },
  frame: { width: number; height: number } = { width: 0, height: 0 }
): boolean {
  if (display.width === 0 || display.height === 0) return false
  return (
    size.width + frame.width > display.width ||
    size.height + frame.height > display.height
  )
}

/** これより長い周期のスケール（110% は 10）は位置を揃えない。動く量のほうが目立つため。 */
const MAX_POSITION_STEP = 8

/**
 * ウィンドウの位置を揃える周期（125% と 175% は 4、150% は 2、整数なら 1）。
 * 端数のスケールでは位置を実ピクセルにするときの丸めでウィンドウが広がるので、
 * 位置に掛けて整数になる倍数へ揃えると、指定のサイズに届く（Windows の実機で確認）。
 */
export function positionStep(scale: number): number {
  for (let step = 1; step <= MAX_POSITION_STEP; step++) {
    const scaled = scale * step
    if (Math.abs(scaled - Math.round(scaled)) < 0.001) return step
  }
  return 1
}

/**
 * 位置を周期の倍数へ切り下げる。作業領域の外（隣のモニター）に出るときは 1 周期分戻す。
 */
export function alignPosition(
  position: WindowPosition,
  step: number,
  area?: { left: number; top: number } | null
): WindowPosition {
  const align = (value: number, min?: number) => {
    const aligned = value - (((value % step) + step) % step)
    return min !== undefined && aligned < min ? aligned + step : aligned
  }
  return { left: align(position.left, area?.left), top: align(position.top, area?.top) }
}

/** 指定したウィンドウのサイズと、その結果のタブのサイズ。 */
export interface FitAttempt {
  request: number
  actual: number
}

/**
 * 次に指定するウィンドウのサイズ（幅か高さの片方）。これ以上直さなくてよければ null。
 * 端数のスケールでは届かない数がある（125% の幅 643 は 642 と 644 にしかならない）。
 * 同じ指定に戻るときは届かないので、指定以上で最小のものを残す。誤差は必ず＋側に出す
 * （画像は大きい分しか切り詰めて揃えられないため）。
 */
export function nextWindowSize(attempts: FitAttempt[], want: number): number | null {
  const last = attempts[attempts.length - 1]
  if (last.actual === want) return null
  const next = last.request + want - last.actual
  if (!attempts.some((attempt) => attempt.request === next)) return next
  const above = attempts
    .filter((attempt) => attempt.actual > want)
    .sort((a, b) => a.actual - b.actual)[0]
  return !above || above.request === last.request ? null : above.request
}

/**
 * 最後に指定したビューポートのサイズとの差が、これ以内なら指定のサイズとして扱う。
 * 表示スケールが端数だと、ちょうどのサイズを作れないことがある。ふつうは 1 以内で、
 * 位置を揃えられない環境（ChromeOS やスケールを読めないページ）では 2 になることがある。
 */
const REQUESTED_SIZE_TOLERANCE = 2

/**
 * 実際の描画エリアのサイズを、指定されたサイズに揃えて返す。
 * 実際のほうが小さいと画像を切り詰めて揃えられないので、大きいときだけ揃える。
 */
export function snapToRequested(
  actual: { width: number; height: number },
  requested?: { width: number; height: number } | null
): { width: number; height: number } {
  if (!requested) return actual
  const width = actual.width - requested.width
  const height = actual.height - requested.height
  const isClose = (diff: number) => diff >= 0 && diff <= REQUESTED_SIZE_TOLERANCE
  return isClose(width) && isClose(height) ? requested : actual
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
