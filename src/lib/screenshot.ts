import { IMAGE_MIME_TYPES } from "./constants"
import { t } from "./i18n"
import type { ImageFormat } from "./types"

/** JPEG 出力時の品質（0〜100）。 */
const JPEG_QUALITY = 90
/** WebP 出力時の品質（0〜1）。 */
const WEBP_QUALITY = 0.9

/** タイルの撮影は常に PNG（劣化なし）で行い、最終出力時にのみ指定形式へエンコードする。 */
async function captureTilePng(windowId: number): Promise<string> {
  return chrome.tabs.captureVisibleTab(windowId, { format: "png" })
}

/** キャンバスを指定形式の Blob にエンコードする。 */
async function encodeCanvas(canvas: OffscreenCanvas, format: ImageFormat): Promise<Blob> {
  if (format === "jpeg") {
    return canvas.convertToBlob({
      type: IMAGE_MIME_TYPES.jpeg,
      quality: JPEG_QUALITY / 100
    })
  }
  if (format === "webp") {
    return canvas.convertToBlob({ type: IMAGE_MIME_TYPES.webp, quality: WEBP_QUALITY })
  }
  return canvas.convertToBlob({ type: IMAGE_MIME_TYPES.png })
}

/**
 * 現在の表示部分（Visible Tab）のスクリーンショットを撮影する。
 * @param format 出力形式（既定は PNG）
 * @returns 指定形式のdata URL
 */
export async function captureVisibleTab(
  windowId: number,
  format: ImageFormat = "png"
): Promise<string> {
  const pngDataUrl = await captureTilePng(windowId)
  if (format === "png") return pngDataUrl

  const bitmap = await createImageBitmap(dataUrlToBlob(pngDataUrl))
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error(t("errCanvas"))
    ctx.drawImage(bitmap, 0, 0)
    return await blobToDataUrl(await encodeCanvas(canvas, format))
  } finally {
    bitmap.close()
  }
}

/**
 * 内側のスクロール要素の表示領域（CSS px、ビューポート基準）。
 * ページ自体はスクロールせず、`height: 100vh; overflow: auto` の div などが
 * 本文をスクロールさせているレイアウトで使う。
 */
interface ScrollerRegion {
  left: number
  top: number
  width: number
  height: number
  scrollHeight: number
  scrollTop: number
}

interface PageMetrics {
  scrollWidth: number
  scrollHeight: number
  viewportWidth: number
  viewportHeight: number
  dpr: number
  scrollX: number
  scrollY: number
  backgroundColor: string
  /** ページ自体がスクロールしない場合に、代わりにスクロールする要素。なければ null。 */
  scroller: ScrollerRegion | null
}

/** captureVisibleTab のレート制限（Chromeは概ね2回/秒程度に制限）に配慮するための待機時間 */
const CAPTURE_INTERVAL_MS = 550
/** スクロール後、レイアウト安定・遅延読み込み画像の描画を待つ時間 */
const SCROLL_SETTLE_MS = 220
/** 固定要素を隠した後、スタイルが描画に反映されるのを待つ時間 */
const HIDE_SETTLE_MS = 120
/** 撮影タイル数の上限（無限スクロールページで撮影が終わらなくなるのを防ぐ） */
const MAX_TILES = 40
/** Canvas / 画像の実用上限（ブラウザ実装依存の巨大画像エラーを避けるための保守的な値） */
const MAX_CANVAS_DIMENSION = 32000
const MAX_CANVAS_AREA = 268435456 // 16384 * 16384 相当

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const FIXED_ELEMENTS_STYLE_ID = "__wvr_full_page_capture_style__"
const HIDDEN_ATTR = "data-wvr-hidden-fixed"
/** 内側のスクロール要素に付ける目印。撮影中のスクロール・復元の対象を特定する。 */
export const SCROLLER_ATTR = "data-wvr-scroll-target"
/** 自動でスクロール範囲を撮る条件（ビューポートの面積に占める割合の下限）。 */
const MAIN_SCROLLER_MIN_RATIO = 0.7

/**
 * ページの計測を行う（サイズ、DPI、現在のスクロール位置、背景色）。
 * scrollHeight は documentElement / body / scrollingElement のいずれで取得しても
 * 抜け漏れがないよう、複数の経路を比較した最大値を採用する。
 *
 * スクロール範囲（scroller）の決め方:
 * - usePicked: ユーザーが選んで目印を付けた要素を使う（画面外にはみ出していれば見える位置へスクロールする）
 * - それ以外: ページ自体がスクロールしない場合だけ、表示面積が最大のスクロール要素を探し、
 *   ビューポートの MAIN_SCROLLER_MIN_RATIO 以上を占めるときに目印を付けて使う
 */
async function measurePage(tabId: number, usePicked: boolean): Promise<PageMetrics> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (scrollerAttr: string, picked: boolean, minRatio: number) => {
      const doc = document.documentElement
      const scrollingHeight = document.scrollingElement?.scrollHeight ?? 0
      const scrollingWidth = document.scrollingElement?.scrollWidth ?? 0
      const scrollHeight = Math.max(doc.scrollHeight, scrollingHeight, window.innerHeight)
      // 選んだ範囲を見える位置へスクロールする前の位置（撮影後にここへ戻す）
      const scrollX = window.scrollX
      const scrollY = window.scrollY

      /** スクロールバー・枠線を除いた中身の表示領域を、ビューポート内に切り詰めて返す。 */
      const regionOf = (el: HTMLElement): ScrollerRegion => {
        const rect = el.getBoundingClientRect()
        const innerLeft = rect.left + el.clientLeft
        const innerTop = rect.top + el.clientTop
        const left = Math.max(0, innerLeft)
        const top = Math.max(0, innerTop)
        const right = Math.min(window.innerWidth, innerLeft + el.clientWidth)
        const bottom = Math.min(window.innerHeight, innerTop + el.clientHeight)
        return {
          left,
          top,
          width: right - left,
          height: bottom - top,
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop
        }
      }

      let scroller: ScrollerRegion | null = null
      if (picked) {
        const el = document.querySelector<HTMLElement>(`[${scrollerAttr}]`)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            el.scrollIntoView({ block: "start", behavior: "instant" })
          }
          scroller = regionOf(el)
        }
      } else {
        document.querySelectorAll(`[${scrollerAttr}]`).forEach((el) => {
          el.removeAttribute(scrollerAttr)
        })
        if (scrollHeight <= window.innerHeight + 1) {
          let best: HTMLElement | null = null
          let bestArea = 0
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
            if (el.scrollHeight <= el.clientHeight + 1) continue
            if (!/(auto|scroll|overlay)/.test(window.getComputedStyle(el).overflowY))
              continue
            const area = el.clientWidth * el.clientHeight
            if (area > bestArea) {
              best = el
              bestArea = area
            }
          }
          if (best) {
            const region = regionOf(best)
            // 主要な領域（ビューポートの大半を占める）だけを自動で対象にする
            if (
              region.width * region.height >=
              window.innerWidth * window.innerHeight * minRatio
            ) {
              best.setAttribute(scrollerAttr, "1")
              scroller = region
            }
          }
        }
      }

      return {
        scrollWidth: Math.max(doc.scrollWidth, scrollingWidth, window.innerWidth),
        scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        scrollX,
        scrollY,
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
        scroller
      }
    },
    args: [SCROLLER_ATTR, usePicked, MAIN_SCROLLER_MIN_RATIO]
  })
  if (!result) {
    throw new Error(t("errPageSize"))
  }
  if (usePicked && !result.scroller) {
    throw new Error(t("errPickedAreaMissing"))
  }
  return result
}

/** 撮影用スタイル（スムーススクロール無効化・非表示属性のCSSルール）を一度だけ注入する。 */
async function injectCaptureStyle(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (styleId: string, attr: string, scrollerAttr: string) => {
      if (document.getElementById(styleId)) return
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        html, [${scrollerAttr}] { scroll-behavior: auto !important; }
        *[${attr}] {
          opacity: 0 !important;
          visibility: hidden !important;
          transition: none !important;
          animation: none !important;
        }
      `
      document.head.appendChild(style)
    },
    args: [FIXED_ELEMENTS_STYLE_ID, HIDDEN_ATTR, SCROLLER_ATTR]
  })
}

/**
 * 固定/追従表示（position: fixed / sticky）の要素を一時的に隠す（複数タイルへの多重写り込み防止）。
 * ページによっては「スクロールした後にJSで動的に追従要素が生成・切り替わる」ケースがあるため、
 * 撮影タイルごとに毎回タグを解除→再走査して最新のDOM状態に追従する。
 * 最初のタイル（ページ最上部）はそのままの見た目を残すため、呼び出し側で hide=false を渡す。
 * 内側のスクロール要素を含む要素（それ自体や fixed の親）は、隠すと本文ごと消えるので対象外にする。
 */
async function updateStickyHiding(tabId: number, hide: boolean): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr: string, scrollerAttr: string, shouldHide: boolean) => {
      document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
        el.removeAttribute(attr)
      })
      if (!shouldHide) return
      const scroller = document.querySelector(`[${scrollerAttr}]`)
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (scroller && el.contains(scroller)) return
        const position = window.getComputedStyle(el).position
        if (position === "fixed" || position === "sticky") {
          el.setAttribute(attr, "1")
        }
      })
    },
    args: [HIDDEN_ATTR, SCROLLER_ATTR, hide]
  })
}

/** injectCaptureStyle / updateStickyHiding / measurePage で行った変更を元に戻す。 */
async function restoreAfterCapture(
  tabId: number,
  original: { scrollX: number; scrollY: number; scrollerTop: number }
): Promise<void> {
  await chrome.scripting
    .executeScript({
      target: { tabId },
      func: (
        styleId: string,
        attr: string,
        scrollerAttr: string,
        x: number,
        y: number,
        scrollerTop: number
      ) => {
        document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
          el.removeAttribute(attr)
        })
        document.querySelectorAll<HTMLElement>(`[${scrollerAttr}]`).forEach((el) => {
          el.scrollTo({ top: scrollerTop, behavior: "instant" })
          el.removeAttribute(scrollerAttr)
        })
        window.scrollTo({ left: x, top: y, behavior: "instant" })
        document.getElementById(styleId)?.remove()
      },
      args: [
        FIXED_ELEMENTS_STYLE_ID,
        HIDDEN_ATTR,
        SCROLLER_ATTR,
        original.scrollX,
        original.scrollY,
        original.scrollerTop
      ]
    })
    .catch(() => undefined)
}

/**
 * 指定位置までスクロールし、実際に反映されたスクロール位置と、その時点の最新の
 * viewportHeight を返す（末尾はクランプされる／ウィンドウサイズが変わる場合に備えて
 * スクロールごとに再計測する）。useScroller の場合は内側のスクロール要素をスクロールする
 * （viewportHeight は 0 を返し、呼び出し側は計測時の表示領域の高さを使う）。
 */
async function scrollAndMeasure(
  tabId: number,
  y: number,
  useScroller: boolean
): Promise<{ appliedY: number; viewportHeight: number }> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (targetY: number, scrollerAttr: string | null) => {
      const scroller = scrollerAttr
        ? document.querySelector<HTMLElement>(`[${scrollerAttr}]`)
        : null
      if (scroller) {
        scroller.scrollTo({ top: targetY, behavior: "instant" })
        return { appliedY: scroller.scrollTop, viewportHeight: 0 }
      }
      window.scrollTo({ left: 0, top: targetY, behavior: "instant" })
      return { appliedY: window.scrollY, viewportHeight: window.innerHeight }
    },
    args: [y, useScroller ? SCROLLER_ATTR : null]
  })
  return result ?? { appliedY: y, viewportHeight: 0 }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",")
  const mimeMatch = /data:(.*?);base64/.exec(meta)
  const mime = mimeMatch?.[1] ?? "image/png"
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/** Service Worker には FileReader / URL.createObjectURL が使えないため、Blob を手動で data URL 化する。 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  const base64 = btoa(binary)
  return `data:${blob.type};base64,${base64}`
}

export interface FullPageOptions {
  /** ユーザーが選んで目印を付けたスクロール範囲を撮る。 */
  picked?: boolean
  /** スクロール範囲を撮るとき、最初の1画面の外枠を残し、範囲の下の部分を最後に付け足す。 */
  includeFrame?: boolean
}

/**
 * ページの最上部から最下部まで自動スクロールしながら可視領域を分割撮影し、
 * OffscreenCanvas 上で結合してページ全体（非表示領域含む）の1枚の画像を生成する。
 *
 * - 撮影開始時のページ高さで撮影範囲を固定する（YouTube等の無限スクロールで撮影が終わらなくなるのを防止）
 * - タイル数（MAX_TILES）とキャンバス上限で撮影範囲を制限する（超えた場合はそこまでを1枚にして出力）
 * - fixed/sticky要素の隠蔽は、スクロール後にJSが追従要素を切り替える時間を待ってからタイルごとに再走査する
 *   （最上部タイルのみ隠蔽しない）
 * - 実際のタイル画像から実DPR（devicePixelRatioの申告値とズレる場合がある）を算出する
 * - 最終的な描画済み高さでキャンバスをクロップする（末尾の余白防止）
 *
 * スクロール範囲（measurePage の scroller）があるときは、window ではなくその要素をスクロールする。
 * - 既定（area）: 各タイルから範囲の表示領域だけを切り出し、範囲の中身だけの画像にする
 * - includeFrame（framed）: 最初のタイルの範囲より上と左右（外枠）を残し、範囲の中身を縦に伸ばして、
 *   最後に最初のタイルの範囲より下の部分を付け足す（左右の外枠は最初の1画面分だけが写り、その下は背景色）
 * @param format 出力形式（既定は PNG）。タイルの撮影自体は常に PNG で行う
 * @returns 指定形式のdata URL
 */
export async function captureFullPage(
  tabId: number,
  windowId: number,
  format: ImageFormat = "png",
  options: FullPageOptions = {}
): Promise<string> {
  const metrics = await measurePage(tabId, options.picked ?? false)
  const { scrollWidth, viewportWidth, dpr, scrollX, scrollY, backgroundColor, scroller } =
    metrics
  const layout: "page" | "area" | "framed" = !scroller
    ? "page"
    : options.includeFrame
      ? "framed"
      : "area"
  // framed のとき、範囲の上・下にある外枠の高さ（CSS px）
  const frameTop = scroller && layout === "framed" ? scroller.top : 0
  const frameBottom =
    scroller && layout === "framed"
      ? metrics.viewportHeight - (scroller.top + scroller.height)
      : 0
  // 1回のスクロール量（ページなら viewport の高さ、スクロール範囲ならその表示領域の高さ）
  let step = scroller ? scroller.height : metrics.viewportHeight
  const scrollLength = scroller ? scroller.scrollHeight : metrics.scrollHeight
  const outputWidth = scroller && layout === "area" ? scroller.width : scrollWidth
  const outputHeight = frameTop + scrollLength + frameBottom

  // 概算値（実DPR判明前）での幅チェック。高さは上限まで切り詰めて撮影する。
  const roughWidth = Math.round(outputWidth * dpr)
  if (roughWidth <= 0 || roughWidth > MAX_CANVAS_DIMENSION) {
    throw new Error(t("errPageTooLarge", { width: outputWidth, height: outputHeight }))
  }

  // 撮影開始時の高さで固定（撮影中に伸びた分は追わない）。キャンバス上限も考慮して切り詰める。
  const maxCanvasHeightRough = Math.min(
    MAX_CANVAS_DIMENSION,
    Math.floor(MAX_CANVAS_AREA / roughWidth)
  )
  // スクロールして撮る範囲の終端（スクロール位置の座標系、CSS px）
  const scrollEnd = Math.min(
    scrollLength,
    Math.floor(maxCanvasHeightRough / dpr) - frameTop - frameBottom
  )

  await injectCaptureStyle(tabId)

  try {
    // 最上部タイル：追従要素はまだ非表示にしない（自然な見た目のヘッダーを残す）
    await updateStickyHiding(tabId, false)
    const first = await scrollAndMeasure(tabId, 0, !!scroller)
    if (!scroller && first.viewportHeight > 0) step = first.viewportHeight
    await wait(SCROLL_SETTLE_MS)

    const firstTileDataUrl = await captureTilePng(windowId)
    const firstBitmap = await createImageBitmap(dataUrlToBlob(firstTileDataUrl))

    // 実際に撮影された画像から実DPRを算出（申告値とズレる場合があるため）
    const realDpr = firstBitmap.width / viewportWidth || dpr
    // スクロール範囲の表示領域（実ピクセル）。各タイルからここを切り出す。
    const crop = scroller
      ? {
          x: Math.round(scroller.left * realDpr),
          y: Math.round(scroller.top * realDpr),
          width: Math.round(scroller.width * realDpr),
          height: Math.round(scroller.height * realDpr)
        }
      : null

    const canvasWidth = crop && layout === "area" ? crop.width : firstBitmap.width
    const maxCanvasHeight = Math.min(
      MAX_CANVAS_DIMENSION,
      Math.floor(MAX_CANVAS_AREA / canvasWidth)
    )
    // 最初のタイルで描く高さ（ページなら全体、area なら範囲、framed なら範囲の下端まで）
    const firstDrawHeight = !crop
      ? firstBitmap.height
      : layout === "area"
        ? crop.height
        : crop.y + crop.height

    if (canvasWidth > MAX_CANVAS_DIMENSION || firstDrawHeight > maxCanvasHeight) {
      firstBitmap.close()
      throw new Error(t("errPageTooLarge", { width: outputWidth, height: outputHeight }))
    }

    const canvasHeight = Math.max(
      Math.min(
        Math.round((frameTop + scrollEnd + frameBottom) * realDpr),
        maxCanvasHeight
      ),
      firstDrawHeight
    )

    let canvas = new OffscreenCanvas(canvasWidth, canvasHeight)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      firstBitmap.close()
      throw new Error(t("errCanvas"))
    }
    ctx.fillStyle = backgroundColor || "#ffffff"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    if (crop && layout === "area") {
      ctx.drawImage(
        firstBitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      )
    } else {
      ctx.drawImage(
        firstBitmap,
        0,
        0,
        firstBitmap.width,
        firstDrawHeight,
        0,
        0,
        firstBitmap.width,
        firstDrawHeight
      )
    }
    let maxBottom = Math.min(firstDrawHeight, canvasHeight)

    // framed: 範囲より下の部分（フッター等）は最後に付け足すため、ここで取っておく
    let below: OffscreenCanvas | null = null
    const belowHeight = firstBitmap.height - firstDrawHeight
    if (crop && layout === "framed" && belowHeight > 0) {
      below = new OffscreenCanvas(firstBitmap.width, belowHeight)
      below
        .getContext("2d")
        ?.drawImage(
          firstBitmap,
          0,
          firstDrawHeight,
          firstBitmap.width,
          belowHeight,
          0,
          0,
          firstBitmap.width,
          belowHeight
        )
    }
    firstBitmap.close()

    // スクロール位置 0 の内容がキャンバス上のどこに来るか（実ピクセル）
    const originY = crop && layout === "framed" ? crop.y : 0
    const destX = crop && layout === "framed" ? crop.x : 0

    await wait(CAPTURE_INTERVAL_MS)

    let lastAppliedY = 0
    let currentY = step
    let tileCount = 1

    while (currentY < scrollEnd && tileCount < MAX_TILES) {
      // 1. 次の撮影位置へスクロールする
      const { appliedY, viewportHeight: latestViewportHeight } = await scrollAndMeasure(
        tabId,
        currentY,
        !!scroller
      )
      if (appliedY === lastAppliedY) {
        break // これ以上スクロールできない（下端に到達）
      }
      lastAppliedY = appliedY
      if (!scroller && latestViewportHeight > 0) step = latestViewportHeight

      // 2. スクロールに反応してJSが追従ヘッダー等を切り替える時間を待つ
      await wait(SCROLL_SETTLE_MS)

      // 3. 切り替わり後の最新DOMから固定/追従要素を走査して隠し、スタイル反映を待つ
      await updateStickyHiding(tabId, true)
      await wait(HIDE_SETTLE_MS)

      // 4. 固定要素が消えた状態で撮影する
      const tileDataUrl = await captureTilePng(windowId)
      const tileBitmap = await createImageBitmap(dataUrlToBlob(tileDataUrl))
      tileCount++

      const destY = originY + Math.round(appliedY * realDpr)
      if (destY >= canvas.height) {
        tileBitmap.close()
        break
      }
      // キャンバス外にはみ出す部分は描画時に自動でクリップされる
      if (crop) {
        ctx.drawImage(
          tileBitmap,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          destX,
          destY,
          crop.width,
          crop.height
        )
        maxBottom = Math.max(maxBottom, Math.min(destY + crop.height, canvas.height))
      } else {
        ctx.drawImage(tileBitmap, 0, destY)
        maxBottom = Math.max(
          maxBottom,
          Math.min(destY + tileBitmap.height, canvas.height)
        )
      }
      tileBitmap.close()

      // レート制限の待機
      await wait(CAPTURE_INTERVAL_MS)

      if (appliedY + step >= scrollEnd) {
        break
      }
      currentY = appliedY + step
    }

    // framed: 範囲の中身の直後に、範囲より下の部分を付け足す
    if (below) {
      ctx.drawImage(below, 0, maxBottom)
      maxBottom = Math.min(maxBottom + below.height, canvas.height)
    }

    // 撮影範囲より手前で終了した場合等、末尾の余白を除去する
    if (maxBottom < canvas.height) {
      const cropped = new OffscreenCanvas(canvas.width, maxBottom)
      const croppedCtx = cropped.getContext("2d")
      if (croppedCtx) {
        croppedCtx.drawImage(canvas, 0, 0)
        canvas = cropped
      }
    }

    return await blobToDataUrl(await encodeCanvas(canvas, format))
  } finally {
    await restoreAfterCapture(tabId, {
      scrollX,
      scrollY,
      scrollerTop: scroller?.scrollTop ?? 0
    })
  }
}
