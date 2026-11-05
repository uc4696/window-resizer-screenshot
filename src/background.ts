import { parseCommand, type ShortcutCommand } from "~lib/commands"
import { SIZE_PRESETS } from "~lib/constants"
import { buildDownloadPath, buildScreenshotFilename } from "~lib/filename"
import { initI18n, t } from "~lib/i18n"
import type {
  BadgeKind,
  CaptureRequest,
  CaptureResponse,
  ExtensionMessage
} from "~lib/messages"
import { startCopyInPage } from "~lib/page-copy"
import { startPicker } from "~lib/picker"
import { exceedsDisplay } from "~lib/placement"
import {
  isZoomed,
  readDisplayFromTab,
  resetTabZoom,
  resizeViewport,
  resizeWindow
} from "~lib/resize"
import {
  ensureInstalledAt,
  markReviewPromptOnUse,
  resetReviewPromptOnUpdate
} from "~lib/review-prompt"
import { captureFullPage, captureVisibleTab } from "~lib/screenshot"
import { getCustomSizes, getPresetOffsets, getSettings, getSizeMode } from "~lib/storage"
import type { SizeMode } from "~lib/types"

/** 結果のバッジ（OK / !）を表示しておく時間（ms）。 */
const BADGE_CLEAR_MS = 3000

const BADGES: Record<BadgeKind, { text: string; color: string }> = {
  busy: { text: "...", color: "#6b7280" },
  ok: { text: "OK", color: "#16a34a" },
  error: { text: "!", color: "#dc2626" }
}

/** タブごとの、バッジを消す予定。新しいバッジを出したら取り消す（前の予定に消されないように）。 */
const badgeClearTimers = new Map<number, ReturnType<typeof setTimeout>>()

function cancelBadgeClear(tabId: number): void {
  const timer = badgeClearTimers.get(tabId)
  if (timer !== undefined) clearTimeout(timer)
  badgeClearTimers.delete(tabId)
}

/**
 * タブ単位でツールバーアイコンにバッジを出す。busy 以外は一定時間後に消す。
 * message を渡すと、バッジが出ている間だけアイコンのツールチップにも出す（popup がない流れで理由を伝える）。
 */
async function showBadge(
  tabId: number,
  kind: BadgeKind,
  message?: string
): Promise<void> {
  const badge = BADGES[kind]
  cancelBadgeClear(tabId)
  await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color })
  await chrome.action.setBadgeText({ tabId, text: badge.text })
  if (message) await chrome.action.setTitle({ tabId, title: message })
  if (kind === "busy") return
  const timer = setTimeout(() => {
    badgeClearTimers.delete(tabId)
    // タブが閉じられていると失敗するので無視する
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined)
    // 空文字を渡すとツールチップが空になるので、既定の文言を入れ直す
    if (message) {
      chrome.action
        .getTitle({})
        .then((title) => chrome.action.setTitle({ tabId, title }))
        .catch(() => undefined)
    }
  }, BADGE_CLEAR_MS)
  badgeClearTimers.set(tabId, timer)
}

/** タブごとの、進行中のカウントダウン。同じタブでまた始めたら前のものをやめる。 */
const countdowns = new Map<number, symbol>()

/**
 * 残り秒数をバッジに出しながら待つ。service worker は処理の途中で止まらない長さ（10秒まで）なので
 * setTimeout で待つ。新しいカウントダウンに置き換えられたら false を返す。
 */
async function countDown(tabId: number, seconds: number): Promise<boolean> {
  const id = Symbol()
  countdowns.set(tabId, id)
  cancelBadgeClear(tabId)
  await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGES.busy.color })
  for (let left = seconds; left > 0; left--) {
    await chrome.action.setBadgeText({ tabId, text: String(left) })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (countdowns.get(tabId) !== id) return false
  }
  countdowns.delete(tabId)
  return true
}

// 評価のお願いの起点。service worker が起きるたびに、記録がなければ今を記録する
void ensureInstalledAt().catch((error) => console.warn("[review-prompt]", error))

// アップデートしたら、評価のお願いの「表示しない」を取り消す（評価した人はそのまま）
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== "update") return
  void resetReviewPromptOnUpdate().catch((error) =>
    console.warn("[review-prompt]", error)
  )
})

/** リサイズ・撮影に成功したときに、評価のお願いの印を付ける（次に popup を開いたときに出す）。 */
function noteUseSucceeded(): void {
  void markReviewPromptOnUse().catch((error) => console.warn("[review-prompt]", error))
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: CaptureResponse) => void
  ) => {
    if (message?.type === "capture-badge") {
      if (sender.tab?.id !== undefined) {
        void showBadge(sender.tab.id, message.kind).catch(() => undefined)
      }
      return
    }
    if (message?.type !== "capture-screenshot") return

    // ページ上の範囲選択から来た依頼は送信元タブ、popup から来た依頼はアクティブタブが対象
    // （拡張機能のページはタブとして開かれていても対象にしない）
    const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL(""))
    const senderTab = fromExtensionPage ? undefined : sender.tab

    if (message.action !== "copy") {
      // 保存は popup を閉じてから行うため、受け付けた時点で応答し、結果はバッジで知らせる
      sendResponse({ ok: true })
      void handleDownloadWithBadge(message, senderTab)
      return
    }

    if (senderTab?.id !== undefined) {
      // ページからのコピー（範囲選択・ショートカット）は popup がないため、撮影中をバッジで示す（結果はページ側から届く）
      void showBadge(senderTab.id, "busy").catch(() => undefined)
    }
    handleCapture(message, senderTab)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message ?? String(error) })
      )

    // 非同期処理のため true を返す
    return true
  }
)

async function resolveTab(
  senderTab?: chrome.tabs.Tab
): Promise<chrome.tabs.Tab | undefined> {
  if (senderTab) return senderTab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function handleDownloadWithBadge(
  message: CaptureRequest,
  senderTab?: chrome.tabs.Tab
): Promise<void> {
  const tab = await resolveTab(senderTab)
  const tabId = tab?.id
  try {
    if (message.delaySeconds && tabId !== undefined) {
      if (!(await countDown(tabId, message.delaySeconds))) return
      // 別のタブに移っていたら、そのタブを写してしまわないように止める
      if (!(await chrome.tabs.get(tabId)).active) throw new Error(t("errDelayTabChanged"))
    }
    if (tabId !== undefined) await showBadge(tabId, "busy").catch(() => undefined)
    const response = await handleCapture(message, tab)
    if (!response.ok) throw new Error(response.error)
    if (tabId !== undefined) await showBadge(tabId, "ok")
  } catch (error) {
    console.error("[capture]", error)
    if (tabId !== undefined) {
      await showBadge(tabId, "error", errorMessage(error)).catch(() => undefined)
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ---- キーボードショートカット（popup が開かないので、結果はバッジで知らせる） ----

chrome.commands.onCommand.addListener((name, tab) => {
  const command = parseCommand(name)
  if (command) void handleCommand(command, tab)
})

async function handleCommand(
  command: ShortcutCommand,
  commandTab?: chrome.tabs.Tab
): Promise<void> {
  // service worker は随時停止・再起動されるため、処理ごとに最新の言語設定を反映する
  await initI18n()
  const tab = await resolveTab(commandTab)
  if (tab?.id === undefined || tab.windowId === undefined) return
  try {
    if (command.kind === "capture") {
      if (command.action === "download") {
        await handleDownloadWithBadge(
          { type: "capture-screenshot", mode: command.mode, action: "download" },
          tab
        )
      } else if (!(await startCopyInPage(tab.id, command.mode))) {
        throw new Error(t("errClipboardUnavailable"))
      }
    } else if (command.kind === "capture-delayed") {
      await handleDownloadWithBadge(
        {
          type: "capture-screenshot",
          mode: "visible",
          action: "download",
          delaySeconds: command.seconds
        },
        tab
      )
    } else if (command.kind === "pick") {
      const count = await startPicker(tab.id, {
        banner: t("pickerBanner"),
        content: t("pickerContent"),
        save: t("pickerSave"),
        copy: t("pickerCopy"),
        cancel: t("pickerCancel")
      })
      if (count === 0) throw new Error(t("capturePickUnavailable"))
    } else {
      await handleResizeCommand(command, tab)
    }
  } catch (error) {
    console.error("[shortcut]", error)
    await showBadge(tab.id, "error", errorMessage(error)).catch(() => undefined)
  }
}

type ResizeCommand = Extract<ShortcutCommand, { kind: "resize-preset" | "resize-custom" }>

/** ショートカットで指定されたサイズと基準を、保存済みの設定から求める。 */
async function resolveResizeSize(command: ResizeCommand): Promise<{
  width: number
  height: number
  offsetWidth: number
  offsetHeight: number
  mode: SizeMode
}> {
  if (command.kind === "resize-custom") {
    const { customSizeSlots } = await getSettings()
    const id = customSizeSlots[command.slot - 1]
    const size = (await getCustomSizes()).find((s) => s.id === id)
    if (!id || !size) {
      throw new Error(t("errShortcutSlotEmpty", { slot: command.slot }))
    }
    return {
      width: size.width,
      height: size.height,
      offsetWidth: size.offsetWidth ?? 0,
      offsetHeight: size.offsetHeight ?? 0,
      mode: size.mode
    }
  }
  const preset = SIZE_PRESETS.find((p) => p.id === command.presetId)
  if (!preset) throw new Error(t("errShortcutPresetUnknown"))
  const [mode, offsets] = await Promise.all([getSizeMode(), getPresetOffsets()])
  const offset = offsets[preset.id]?.[mode]
  return {
    width: preset.width,
    height: preset.height,
    offsetWidth: offset?.offsetWidth ?? 0,
    offsetHeight: offset?.offsetHeight ?? 0,
    mode
  }
}

/**
 * 拡大率が 100% 以外なら 100% に戻す。確認の設定が有効なら、popup がないのでページで確認する。
 * キャンセルされたら false を返す。確認を出せない特殊なページでは拡大率を変えずに進める。
 */
async function resetZoomForShortcut(tabId: number): Promise<boolean> {
  const zoom = await chrome.tabs.getZoom(tabId).catch(() => null)
  if (zoom === null || !isZoomed(zoom)) return true
  const { zoomResetConfirm } = await getSettings()
  if (zoomResetConfirm) {
    const message = t("zoomConfirmMessage", { zoom: Math.round(zoom * 100) })
    const answer = await chrome.scripting
      .executeScript({
        target: { tabId },
        func: (text: string) => window.confirm(text),
        args: [message]
      })
      .then(
        ([{ result }]) => result,
        () => null
      )
    if (answer === null) return true
    if (!answer) return false
  }
  await resetTabZoom(tabId)
  return true
}

async function handleResizeCommand(
  command: ResizeCommand,
  tab: chrome.tabs.Tab
): Promise<void> {
  const tabId = tab.id as number
  const size = await resolveResizeSize(command)
  // popup と同じく、ディスプレイを超えるサイズにはしない（読めない特殊なページではそのまま進める）
  const display = await readDisplayFromTab(tabId)
  if (display && exceedsDisplay(size, display)) {
    throw new Error(t("sizeOverDisplay", { ...display }))
  }
  if (!(await resetZoomForShortcut(tabId))) return
  const target = { tabId, windowId: tab.windowId, url: tab.url }
  if (size.mode === "window") {
    await resizeWindow(
      size.width,
      size.height,
      size.offsetWidth,
      size.offsetHeight,
      target
    )
  } else {
    await resizeViewport(
      size.width + size.offsetWidth,
      size.height + size.offsetHeight,
      target
    )
  }
  await showBadge(tabId, "ok")
  noteUseSucceeded()
}

async function handleCapture(
  message: CaptureRequest,
  senderTab?: chrome.tabs.Tab
): Promise<CaptureResponse> {
  // service worker は随時停止・再起動されるため、処理ごとに最新の言語設定を反映する
  await initI18n()

  const tab = await resolveTab(senderTab)
  if (!tab?.id || tab.windowId === undefined) {
    return { ok: false, error: t("errNoActiveTab") }
  }

  const settings = await getSettings()
  // クリップボードへコピーする場合は常に PNG（Chrome が確実に書き込める形式）
  const isCopy = message.action === "copy"
  const format = isCopy ? "png" : settings.imageFormat

  const dataUrl =
    message.mode === "visible"
      ? await captureVisibleTab(tab.windowId, format)
      : await captureFullPage(tab.id, tab.windowId, format, {
          picked: message.mode === "picked",
          includeFrame: settings.scrollAreaIncludeFrame
        })

  if (isCopy) {
    noteUseSucceeded()
    return { ok: true, dataUrl }
  }

  const filename = buildScreenshotFilename(new Date(), format)
  const path = buildDownloadPath(settings.captureDirName, filename)

  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: path,
    saveAs: false,
    conflictAction: "uniquify"
  })

  noteUseSucceeded()
  return { ok: true, downloadId, filename }
}
