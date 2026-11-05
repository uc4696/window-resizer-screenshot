import assert from "node:assert/strict"
import { test } from "node:test"

import { placeWindow } from "../../src/lib/placement.ts"

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
