import { SCROLLER_ATTR } from "./screenshot"

/** 範囲選択 UI に表示する文言（ページに注入する関数へ引数で渡す）。 */
export interface PickerStrings {
  banner: string
  /** {height} を中身の高さ（px）に置き換える。 */
  content: string
  save: string
  copy: string
  cancel: string
}

/**
 * ページに注入して実行する範囲選択の本体。chrome.scripting.executeScript で
 * 関数ごと送るため、外部の変数・関数を参照せず、この中だけで完結させる。
 *
 * - count: 選べるスクロール範囲の数を返す（popup のボタンの有効/無効に使う）
 * - start: 候補を枠で示し、クリックで選ぶ UI を開始する。選んだ位置に［保存］［コピー］［キャンセル］を出し、
 *   押されたら要素に目印を付けて background に撮影を依頼する。Esc でいつでも中止できる。
 */
function scrollAreaPicker(
  mode: "count" | "start",
  scrollerAttr: string,
  strings: PickerStrings | null
): number {
  /** 小さすぎるスクロール領域（ドロップダウン等）は候補にしない。 */
  const MIN_WIDTH = 120
  const MIN_HEIGHT = 80

  const isCandidate = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false
    if (el.scrollHeight <= el.clientHeight + 1) return false
    if (el.clientWidth < MIN_WIDTH || el.clientHeight < MIN_HEIGHT) return false
    if (!/(auto|scroll|overlay)/.test(window.getComputedStyle(el).overflowY)) return false
    const rect = el.getBoundingClientRect()
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    )
  }
  const findCandidates = () =>
    Array.from(document.querySelectorAll("body *")).filter(isCandidate)

  if (mode === "count") return findCandidates().length
  if (!strings) return 0

  // 二重に開始された場合は前の UI を片付けてからやり直す（isolated world の window に保持）
  const state = window as unknown as { __wvrPickerCleanup?: () => void }
  state.__wvrPickerCleanup?.()

  const candidates = findCandidates()
  if (candidates.length === 0) return 0

  const host = document.createElement("div")
  host.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;pointer-events:none;margin:0;padding:0;border:0"
  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .box { position: fixed; border: 2px dashed rgba(79, 70, 229, 0.85); background: rgba(79, 70, 229, 0.06); }
      .box.hover { border-style: solid; background: rgba(79, 70, 229, 0.18); }
      .box.selected { border: 3px solid #4f46e5; background: rgba(79, 70, 229, 0.22); }
      .label { position: fixed; display: none; padding: 2px 6px; font-size: 12px; line-height: 1.4;
        color: #fff; background: #4f46e5; border-radius: 4px; white-space: nowrap; }
      .banner { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); padding: 6px 14px;
        font-size: 13px; line-height: 1.4; color: #fff; background: #111827; border-radius: 999px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); white-space: nowrap; }
      .menu { position: fixed; display: none; gap: 6px; padding: 6px; background: #fff;
        border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        pointer-events: auto; }
      .menu button { padding: 4px 12px; font-size: 13px; line-height: 1.4; color: #4f46e5; background: #fff;
        border: 1px solid #4f46e5; border-radius: 6px; cursor: pointer; }
      .menu button.primary { color: #fff; background: #4f46e5; }
      .menu button:hover { opacity: 0.85; }
    </style>
    <div class="boxes"></div>
    <div class="label"></div>
    <div class="banner"></div>
    <div class="menu" role="menu"></div>
  `
  const boxesEl = root.querySelector(".boxes") as HTMLDivElement
  const labelEl = root.querySelector(".label") as HTMLDivElement
  const bannerEl = root.querySelector(".banner") as HTMLDivElement
  const menuEl = root.querySelector(".menu") as HTMLDivElement
  bannerEl.textContent = strings.banner

  const boxes = candidates.map(() => {
    const box = document.createElement("div")
    box.className = "box"
    boxesEl.appendChild(box)
    return box
  })

  let hovered: HTMLElement | null = null
  let selected: HTMLElement | null = null

  /** スクロール・リサイズで位置が変わるため、枠は毎回 getBoundingClientRect から描き直す。 */
  const render = () => {
    candidates.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      const box = boxes[i]
      box.style.left = `${rect.left}px`
      box.style.top = `${rect.top}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${rect.height}px`
      box.classList.toggle("hover", el === hovered && !selected)
      box.classList.toggle("selected", el === selected)
    })
    const target = selected ?? hovered
    if (target) {
      const rect = target.getBoundingClientRect()
      const tag = target.tagName.toLowerCase()
      labelEl.textContent = `${tag} ${Math.round(rect.width)}×${Math.round(rect.height)} / ${strings.content.replace("{height}", String(target.scrollHeight))}`
      labelEl.style.display = "block"
      labelEl.style.left = `${Math.max(0, rect.left)}px`
      labelEl.style.top = `${Math.max(0, rect.top - 22)}px`
    } else {
      labelEl.style.display = "none"
    }
  }

  /** 指定位置にある候補のうち、いちばん内側（面積が最小）のものを返す。入れ子の範囲も選べる。 */
  const candidateAt = (x: number, y: number): HTMLElement | null => {
    let best: HTMLElement | null = null
    let bestArea = Infinity
    for (const el of candidates) {
      const rect = el.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
      const area = rect.width * rect.height
      if (area < bestArea) {
        best = el
        bestArea = area
      }
    }
    return best
  }

  const isOwnEvent = (event: Event) => event.composedPath().includes(host)

  const onMove = (event: MouseEvent) => {
    if (selected || isOwnEvent(event)) return
    const next = candidateAt(event.clientX, event.clientY)
    if (next !== hovered) {
      hovered = next
      render()
    }
  }

  /** 選択中はページ側のクリック等を止め、誤操作でリンク遷移やボタン動作が起きないようにする。 */
  const block = (event: Event) => {
    if (isOwnEvent(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const showMenu = (x: number, y: number) => {
    menuEl.textContent = ""
    const addButton = (text: string, primary: boolean, onClick: () => void) => {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = text
      if (primary) button.className = "primary"
      button.addEventListener("click", onClick)
      menuEl.appendChild(button)
    }
    addButton(strings.save, true, () => run("download"))
    // http のページ等ではクリップボード API が使えないため、コピーは出さない
    if (
      window.isSecureContext &&
      navigator.clipboard &&
      typeof ClipboardItem !== "undefined"
    ) {
      addButton(strings.copy, false, () => run("copy"))
    }
    addButton(strings.cancel, false, cleanup)
    menuEl.style.display = "flex"
    // 画面外にはみ出さないよう位置を調整する
    const width = menuEl.offsetWidth
    const height = menuEl.offsetHeight
    menuEl.style.left = `${Math.min(Math.max(8, x), window.innerWidth - width - 8)}px`
    menuEl.style.top = `${Math.min(Math.max(8, y + 12), window.innerHeight - height - 8)}px`
  }

  const onClick = (event: MouseEvent) => {
    if (isOwnEvent(event)) return
    block(event)
    const target = candidateAt(event.clientX, event.clientY)
    if (!target) {
      // 候補の外をクリックしたら選択を解除して選び直せるようにする
      selected = null
      menuEl.style.display = "none"
      render()
      return
    }
    selected = target
    hovered = target
    render()
    showMenu(event.clientX, event.clientY)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    event.stopImmediatePropagation()
    cleanup()
  }

  let frame = 0
  const onViewportChange = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(render)
  }

  const blockedEvents = [
    "mousedown",
    "mouseup",
    "pointerdown",
    "pointerup",
    "dblclick",
    "contextmenu"
  ]

  function cleanup() {
    window.removeEventListener("mousemove", onMove, true)
    window.removeEventListener("click", onClick, true)
    window.removeEventListener("keydown", onKeyDown, true)
    window.removeEventListener("scroll", onViewportChange, true)
    window.removeEventListener("resize", onViewportChange, true)
    blockedEvents.forEach((type) => window.removeEventListener(type, block, true))
    cancelAnimationFrame(frame)
    host.remove()
    if (state.__wvrPickerCleanup === cleanup) delete state.__wvrPickerCleanup
  }

  /** 選んだ要素に目印を付け、UI を消してから background に撮影を依頼する（UI を写さないため）。 */
  function run(action: "download" | "copy") {
    const target = selected
    cleanup()
    if (!target) return
    document.querySelectorAll(`[${scrollerAttr}]`).forEach((el) => {
      el.removeAttribute(scrollerAttr)
    })
    target.setAttribute(scrollerAttr, "1")
    const request = { type: "capture-screenshot", mode: "picked", action }
    if (action === "download") {
      void chrome.runtime.sendMessage(request)
      return
    }
    // クリック直後に書き込みを始め、画像は Promise で渡す（撮影に時間がかかっても操作の有効期限が切れない）
    const blob = chrome.runtime
      .sendMessage(request)
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
  }

  window.addEventListener("mousemove", onMove, true)
  window.addEventListener("click", onClick, true)
  window.addEventListener("keydown", onKeyDown, true)
  window.addEventListener("scroll", onViewportChange, true)
  window.addEventListener("resize", onViewportChange, true)
  blockedEvents.forEach((type) => window.addEventListener(type, block, true))
  state.__wvrPickerCleanup = cleanup

  document.documentElement.appendChild(host)
  render()
  return candidates.length
}

/** 対象タブで選べるスクロール範囲の数を返す。スクリプトを注入できないページ（chrome:// 等）は 0。 */
export async function countPickCandidates(tabId: number): Promise<number> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrollAreaPicker,
      args: ["count", SCROLLER_ATTR, null]
    })
    return result ?? 0
  } catch {
    return 0
  }
}

/** 対象タブで範囲選択の UI を開始する。 */
export async function startPicker(tabId: number, strings: PickerStrings): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: scrollAreaPicker,
    args: ["start", SCROLLER_ATTR, strings]
  })
}
