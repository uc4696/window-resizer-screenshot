import assert from "node:assert/strict"
import { test } from "node:test"

import {
  exceedsDisplay,
  placeWindow,
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
