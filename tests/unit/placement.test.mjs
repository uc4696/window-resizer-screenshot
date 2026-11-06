import assert from "node:assert/strict"
import { test } from "node:test"

import {
  alignPosition,
  exceedsDisplay,
  nextWindowSize,
  placeWindow,
  positionStep,
  resolveCurrentSize,
  snapToRequested
} from "../../src/lib/placement.ts"

/** 1920x1080 の画面。下に 40px のタスクバー。 */
const AREA = { left: 0, top: 0, width: 1920, height: 1040 }

test("画面に収まっていれば動かさない", () => {
  const position = placeWindow(
    { left: 100, top: 100 },
    { width: 1280, height: 720 },
    AREA
  )
  assert.equal(position, null)
})

test("右と下にはみ出す分だけ動かす（作業領域の端まで）", () => {
  assert.deepEqual(
    placeWindow({ left: 1500, top: 800 }, { width: 1280, height: 720 }, AREA),
    { left: 640, top: 320 }
  )
})

test("片方だけはみ出すなら、その方向だけ動かす", () => {
  assert.deepEqual(
    placeWindow({ left: 1000, top: 100 }, { width: 1280, height: 720 }, AREA),
    { left: 640, top: 100 }
  )
})

test("左と上にはみ出しているときも戻す", () => {
  assert.deepEqual(
    placeWindow({ left: -300, top: -50 }, { width: 800, height: 600 }, AREA),
    { left: 0, top: 0 }
  )
})

test("画面より大きいサイズは右端と上端に合わせる（ツールバーのアイコンが見える）", () => {
  assert.deepEqual(
    placeWindow({ left: 300, top: 300 }, { width: 2560, height: 1440 }, AREA),
    { left: -640, top: 0 }
  )
})

test("高さだけ作業領域より大きいとき（タスクバーの分）は上端に合わせ、幅は収める", () => {
  assert.deepEqual(
    placeWindow({ left: 500, top: 200 }, { width: 1280, height: 1080 }, AREA),
    { left: 500, top: 0 }
  )
})

test("幅だけ大きいときは右端に合わせ、高さは収める", () => {
  assert.deepEqual(
    placeWindow({ left: 0, top: 500 }, { width: 2560, height: 720 }, AREA),
    { left: -640, top: 320 }
  )
})

test("2枚目のモニター（負の座標や原点以外の作業領域）でもその画面の中に収める", () => {
  const second = { left: 1920, top: -200, width: 1280, height: 984 }
  assert.deepEqual(
    placeWindow({ left: 2800, top: 700 }, { width: 800, height: 600 }, second),
    { left: 2400, top: 184 }
  )
  const leftSide = { left: -1280, top: 0, width: 1280, height: 720 }
  assert.deepEqual(
    placeWindow({ left: -100, top: 0 }, { width: 800, height: 600 }, leftSide),
    { left: -800, top: 0 }
  )
})

test("画面と同じ大きさなら原点に合う", () => {
  assert.deepEqual(
    placeWindow({ left: 10, top: 10 }, { width: 1920, height: 1040 }, AREA),
    { left: 0, top: 0 }
  )
})

test("片方でもディスプレイを超えたら超えたものとする", () => {
  const display = { width: 1280, height: 720 }
  assert.equal(exceedsDisplay({ width: 1280, height: 720 }, display), false)
  assert.equal(exceedsDisplay({ width: 800, height: 600 }, display), false)
  assert.equal(exceedsDisplay({ width: 1024, height: 768 }, display), true)
  assert.equal(exceedsDisplay({ width: 1281, height: 100 }, display), true)
})

test("ディスプレイが未取得なら超えないものとする", () => {
  assert.equal(
    exceedsDisplay({ width: 3840, height: 2160 }, { width: 0, height: 0 }),
    false
  )
})

test("最大化中のウィンドウ基準はディスプレイのサイズを使う", () => {
  const sizes = {
    window: { width: 1936, height: 1056 },
    viewport: { width: 1920, height: 950 },
    display: { width: 1920, height: 1080 }
  }
  assert.deepEqual(resolveCurrentSize("window", sizes, "maximized"), sizes.display)
  assert.deepEqual(resolveCurrentSize("window", sizes, "fullscreen"), sizes.display)
  assert.deepEqual(resolveCurrentSize("window", sizes, "normal"), sizes.window)
  assert.deepEqual(resolveCurrentSize("viewport", sizes, "maximized"), sizes.viewport)
})

const REQUESTED = { width: 1280, height: 720 }

test("snapToRequested: 2px 以内で大きいときは、指定のサイズに揃える", () => {
  assert.deepEqual(snapToRequested({ width: 1280, height: 721 }, REQUESTED), REQUESTED)
  assert.deepEqual(snapToRequested({ width: 1282, height: 722 }, REQUESTED), REQUESTED)
})

test("snapToRequested: 3px 以上の差はそのまま", () => {
  const actual = { width: 1280, height: 723 }
  assert.deepEqual(snapToRequested(actual, REQUESTED), actual)
})

test("snapToRequested: 小さいときは切り詰めて揃えられないのでそのまま", () => {
  const actual = { width: 1280, height: 719 }
  assert.deepEqual(snapToRequested(actual, REQUESTED), actual)
})

test("snapToRequested: 指定がなければそのまま", () => {
  const actual = { width: 1280, height: 721 }
  assert.deepEqual(snapToRequested(actual, undefined), actual)
})

test("ビューポート基準は枠の分も足して比べる", () => {
  const display = { width: 1463, height: 823 }
  const frame = { width: 14, height: 94 }
  assert.equal(exceedsDisplay({ width: 1024, height: 768 }, display), false)
  assert.equal(exceedsDisplay({ width: 1024, height: 768 }, display, frame), true)
  assert.equal(exceedsDisplay({ width: 1280, height: 720 }, display, frame), false)
  assert.equal(exceedsDisplay({ width: 1449, height: 729 }, display, frame), false)
  assert.equal(exceedsDisplay({ width: 1449, height: 730 }, display, frame), true)
  assert.equal(exceedsDisplay({ width: 1450, height: 729 }, display, frame), true)
})

test("位置を揃える周期はスケールに掛けて整数になる倍数", () => {
  assert.equal(positionStep(1), 1)
  assert.equal(positionStep(2), 1)
  assert.equal(positionStep(1.25), 4)
  assert.equal(positionStep(1.5), 2)
  assert.equal(positionStep(1.75), 4)
  assert.equal(positionStep(2.25), 4)
  assert.equal(positionStep(1.100000023841858), 1) // 周期 10 は揃えない
})

test("位置は周期の倍数へ切り下げ、作業領域の外に出るなら戻す", () => {
  assert.deepEqual(alignPosition({ left: 103, top: 43 }, 4), { left: 100, top: 40 })
  assert.deepEqual(alignPosition({ left: 103, top: 43 }, 2), { left: 102, top: 42 })
  assert.deepEqual(alignPosition({ left: 103, top: 43 }, 1), { left: 103, top: 43 })
  assert.deepEqual(alignPosition({ left: -7, top: 0 }, 4), { left: -8, top: 0 })
  assert.deepEqual(alignPosition({ left: 1463, top: 0 }, 4, { left: 1463, top: 0 }), {
    left: 1464,
    top: 0
  })
})

/** 実機の 125% の表（指定 → タブのサイズ）で手順を動かし、最後のタブのサイズを返す。 */
function runFit(table, first, want) {
  const attempts = []
  let request = first
  for (let i = 0; i < 5; i++) {
    attempts.push({ request, actual: table[request] })
    const next = nextWindowSize(attempts, want)
    if (next === null) return attempts[attempts.length - 1].actual
    request = next
  }
  return table[request]
}

const TABLE_125 = { 653: 640, 654: 640, 655: 641, 656: 642, 657: 644, 658: 645 }

test("届くサイズはちょうどに直す", () => {
  assert.equal(runFit(TABLE_125, 654, 640), 640)
  assert.equal(runFit(TABLE_125, 657, 641), 641)
  assert.equal(runFit(TABLE_125, 654, 642), 642)
})

test("届かないサイズは＋側で最小のものを残す", () => {
  assert.equal(runFit(TABLE_125, 657, 643), 644)
  assert.equal(runFit(TABLE_125, 656, 643), 644)
})

test("ちょうどなら直さない", () => {
  assert.equal(nextWindowSize([{ request: 654, actual: 640 }], 640), null)
})

test("上限で伸びないときは止まる（同じ指定を繰り返さない）", () => {
  const table = { 862: 746, 884: 746, 906: 746, 928: 746, 950: 746, 972: 746 }
  assert.equal(runFit(table, 862, 768), 746)
})
