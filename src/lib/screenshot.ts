import { t } from "./i18n"

const JPEG_QUALITY = 90

/**
 * 現在の表示部分（Visible Tab）のスクリーンショットを撮影する。
 * @returns JPEG形式のdata URL
 */
export async function captureVisibleTab(windowId: number): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "jpeg",
    quality: JPEG_QUALITY
  })
  return dataUrl
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

/**
 * ページの計測を行う（サイズ、DPI、現在のスクロール位置、背景色）。
 * scrollHeight は documentElement / body / scrollingElement のいずれで取得しても
 * 抜け漏れがないよう、複数の経路を比較した最大値を採用する。
 */
async function measurePage(tabId: number): Promise<PageMetrics> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const doc = document.documentElement
      const scrollingHeight = document.scrollingElement?.scrollHeight ?? 0
      const scrollingWidth = document.scrollingElement?.scrollWidth ?? 0
      return {
        scrollWidth: Math.max(doc.scrollWidth, scrollingWidth, window.innerWidth),
        scrollHeight: Math.max(doc.scrollHeight, scrollingHeight, window.innerHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        backgroundColor: window.getComputedStyle(document.body).backgroundColor
      }
    }
  })
  if (!result) {
    throw new Error(t("errPageSize"))
  }
  return result
}

const FIXED_ELEMENTS_STYLE_ID = "__wvr_full_page_capture_style__"
const HIDDEN_ATTR = "data-wvr-hidden-fixed"

/** 撮影用スタイル（スムーススクロール無効化・非表示属性のCSSルール）を一度だけ注入する。 */
async function injectCaptureStyle(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (styleId: string, attr: string) => {
      if (document.getElementById(styleId)) return
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        html { scroll-behavior: auto !important; }
        *[${attr}] {
          opacity: 0 !important;
          visibility: hidden !important;
          transition: none !important;
          animation: none !important;
        }
      `
      document.head.appendChild(style)
    },
    args: [FIXED_ELEMENTS_STYLE_ID, HIDDEN_ATTR]
  })
}

/**
 * 固定/追従表示（position: fixed / sticky）の要素を一時的に隠す（複数タイルへの多重写り込み防止）。
 * ページによっては「スクロールした後にJSで動的に追従要素が生成・切り替わる」ケースがあるため、
 * 撮影タイルごとに毎回タグを解除→再走査して最新のDOM状態に追従する。
 * 最初のタイル（ページ最上部）はそのままの見た目を残すため、呼び出し側で hide=false を渡す。
 */
async function updateStickyHiding(tabId: number, hide: boolean): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr: string, shouldHide: boolean) => {
      document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
        el.removeAttribute(attr)
      })
      if (!shouldHide) return
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const position = window.getComputedStyle(el).position
        if (position === "fixed" || position === "sticky") {
          el.setAttribute(attr, "1")
        }
      })
    },
    args: [HIDDEN_ATTR, hide]
  })
}

/** injectCaptureStyle / updateStickyHiding で行った変更を元に戻す。 */
async function restoreAfterCapture(
  tabId: number,
  original: { scrollX: number; scrollY: number }
): Promise<void> {
  await chrome.scripting
    .executeScript({
      target: { tabId },
      func: (styleId: string, attr: string, x: number, y: number) => {
        document.getElementById(styleId)?.remove()
        document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
          el.removeAttribute(attr)
        })
        window.scrollTo(x, y)
      },
      args: [FIXED_ELEMENTS_STYLE_ID, HIDDEN_ATTR, original.scrollX, original.scrollY]
    })
    .catch(() => undefined)
}

/**
 * 指定位置までスクロールし、実際に反映された scrollY と、その時点の最新の
 * scrollHeight / viewportHeight を返す（末尾はクランプされる／遅延読み込みで
 * ページ高さが変動するため、スクロールごとに再計測する）。
 */
async function scrollAndMeasure(
  tabId: number,
  x: number,
  y: number
): Promise<{ appliedY: number; scrollHeight: number; viewportHeight: number }> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (targetX: number, targetY: number) => {
      window.scrollTo(targetX, targetY)
      const scrollingHeight = document.scrollingElement?.scrollHeight ?? 0
      return {
        appliedY: window.scrollY,
        scrollHeight: Math.max(
          document.documentElement.scrollHeight,
          scrollingHeight,
          window.innerHeight
        ),
        viewportHeight: window.innerHeight
      }
    },
    args: [x, y]
  })
  return result ?? { appliedY: y, scrollHeight: 0, viewportHeight: 0 }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",")
  const mimeMatch = /data:(.*?);base64/.exec(meta)
  const mime = mimeMatch?.[1] ?? "image/jpeg"
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
 * @returns JPEG形式のdata URL
 */
export async function captureFullPage(tabId: number, windowId: number): Promise<string> {
  const metrics = await measurePage(tabId)
  const { scrollWidth, viewportWidth, dpr, scrollX, scrollY, backgroundColor } = metrics
  let viewportHeight = metrics.viewportHeight

  // 概算値（実DPR判明前）での幅チェック。高さは上限まで切り詰めて撮影する。
  const roughWidth = Math.round(scrollWidth * dpr)
  if (roughWidth <= 0 || roughWidth > MAX_CANVAS_DIMENSION) {
    throw new Error(
      t("errPageTooLarge", { width: scrollWidth, height: metrics.scrollHeight })
    )
  }

  // 撮影開始時の高さで固定（撮影中に伸びた分は追わない）。キャンバス上限も考慮して切り詰める。
  const maxCanvasHeightRough = Math.min(
    MAX_CANVAS_DIMENSION,
    Math.floor(MAX_CANVAS_AREA / roughWidth)
  )
  const targetHeight = Math.min(metrics.scrollHeight, Math.floor(maxCanvasHeightRough / dpr))

  await injectCaptureStyle(tabId)

  try {
    // 最上部タイル：追従要素はまだ非表示にしない（自然な見た目のヘッダーを残す）
    await updateStickyHiding(tabId, false)
    const first = await scrollAndMeasure(tabId, 0, 0)
    viewportHeight = first.viewportHeight || viewportHeight
    await wait(SCROLL_SETTLE_MS)

    const firstTileDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: JPEG_QUALITY
    })
    const firstBitmap = await createImageBitmap(dataUrlToBlob(firstTileDataUrl))

    // 実際に撮影された画像から実DPRを算出（申告値とズレる場合があるため）
    const realDpr = firstBitmap.width / viewportWidth || dpr
    const canvasWidth = firstBitmap.width
    const maxCanvasHeight = Math.min(MAX_CANVAS_DIMENSION, Math.floor(MAX_CANVAS_AREA / canvasWidth))

    if (canvasWidth > MAX_CANVAS_DIMENSION || firstBitmap.height > maxCanvasHeight) {
      firstBitmap.close()
      throw new Error(
        t("errPageTooLarge", { width: scrollWidth, height: metrics.scrollHeight })
      )
    }

    const canvasHeight = Math.max(
      Math.min(Math.round(targetHeight * realDpr), maxCanvasHeight),
      firstBitmap.height
    )

    let canvas = new OffscreenCanvas(canvasWidth, canvasHeight)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      firstBitmap.close()
      throw new Error(t("errCanvas"))
    }
    ctx.fillStyle = backgroundColor || "#ffffff"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.drawImage(firstBitmap, 0, 0)
    let maxBottom = Math.min(firstBitmap.height, canvasHeight)
    firstBitmap.close()

    await wait(CAPTURE_INTERVAL_MS)

    let lastAppliedY = 0
    let currentY = viewportHeight
    let tileCount = 1

    while (currentY < targetHeight && tileCount < MAX_TILES) {
      // 1. 次の撮影位置へスクロールする
      const { appliedY, viewportHeight: latestViewportHeight } = await scrollAndMeasure(
        tabId,
        0,
        currentY
      )
      if (appliedY === lastAppliedY) {
        break // これ以上スクロールできない（下端に到達）
      }
      lastAppliedY = appliedY
      if (latestViewportHeight > 0) viewportHeight = latestViewportHeight

      // 2. スクロールに反応してJSが追従ヘッダー等を切り替える時間を待つ
      await wait(SCROLL_SETTLE_MS)

      // 3. 切り替わり後の最新DOMから固定/追従要素を走査して隠し、スタイル反映を待つ
      await updateStickyHiding(tabId, true)
      await wait(HIDE_SETTLE_MS)

      // 4. 固定要素が消えた状態で撮影する
      const tileDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "jpeg",
        quality: JPEG_QUALITY
      })
      const tileBitmap = await createImageBitmap(dataUrlToBlob(tileDataUrl))
      tileCount++

      const destY = Math.round(appliedY * realDpr)
      if (destY >= canvas.height) {
        tileBitmap.close()
        break
      }
      // キャンバス外にはみ出す部分は描画時に自動でクリップされる
      ctx.drawImage(tileBitmap, 0, destY)
      maxBottom = Math.max(maxBottom, Math.min(destY + tileBitmap.height, canvas.height))
      tileBitmap.close()

      // レート制限の待機
      await wait(CAPTURE_INTERVAL_MS)

      if (appliedY + viewportHeight >= targetHeight) {
        break
      }
      currentY = appliedY + viewportHeight
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

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY / 100
    })
    return await blobToDataUrl(blob)
  } finally {
    await restoreAfterCapture(tabId, { scrollX, scrollY })
  }
}
