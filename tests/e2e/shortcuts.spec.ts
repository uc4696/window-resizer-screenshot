import type { Worker } from "@playwright/test"

import { expect, test, type Page } from "./fixtures"
import { getDownloadRequests, getWindowSize, recordDownloadRequests } from "./helpers"

/**
 * ショートカットの処理を呼ぶ。キー操作そのものは自動テストでは送れないので、
 * テスト用の複製で控えた onCommand のリスナーを、対象ページのタブを渡して呼ぶ。
 */
async function runCommand(serviceWorker: Worker, target: Page, name: string) {
  await target.bringToFront()
  // 前面にした直後は描画が間に合わず、撮影が image readback failed で失敗するので待つ
  await target.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 200)))
      )
  )
  await serviceWorker.evaluate(
    async ({ name, url }) => {
      const [tab] = await chrome.tabs.query({ url })
      const listeners = (
        globalThis as unknown as {
          __commandListeners: ((name: string, tab: chrome.tabs.Tab) => void)[]
        }
      ).__commandListeners
      listeners.forEach((listener) => listener(name, tab))
    },
    { name, url: target.url() }
  )
}

function getBadge(serviceWorker: Worker, target: Page) {
  return serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    return chrome.action.getBadgeText({ tabId: tab.id })
  }, target.url())
}

function getTitle(serviceWorker: Worker, target: Page) {
  return serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    return chrome.action.getTitle({ tabId: tab.id })
  }, target.url())
}

test.describe("キーボードショートカット", () => {
  test("既定ではどのコマンドにもキーが割り当てられていない", async ({
    serviceWorker
  }) => {
    const commands = await serviceWorker.evaluate(() => chrome.commands.getAll())
    expect(commands.filter((c) => c.shortcut)).toEqual([])
    expect(commands.map((c) => c.name)).toContain("resize-custom-5")
  })

  test("プリセット: popup で最後に選んだ基準でリサイズし、結果をバッジに出す", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")

    await runCommand(serviceWorker, target, "resize-preset-svga")
    await expect
      .poll(() => getWindowSize(serviceWorker, target))
      .toEqual({ width: 800, height: 600 })
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("OK")

    // ビューポート基準を選ぶと、ショートカットもビューポート基準になる
    const popup = await openPopup(target)
    await popup.getByRole("button", { name: "Viewport-based" }).click()
    await popup.close()
    await runCommand(serviceWorker, target, "resize-preset-xga")
    await expect
      .poll(() =>
        target.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
      )
      .toEqual({ width: 1024, height: 768 })
  })

  test("ディスプレイを超えるプリセットはリサイズせず、! とツールチップで知らせる", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const before = await getWindowSize(serviceWorker, target)
    await runCommand(serviceWorker, target, "resize-preset-uxga")
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("!")
    expect(await getTitle(serviceWorker, target)).toContain("Larger than this display")
    expect(await getWindowSize(serviceWorker, target)).toEqual(before)
  })

  test("カスタムサイズの枠: 割り当てがなければ ! とツールチップで知らせ、割り当てるとそのサイズにする", async ({
    context,
    extensionId,
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    await runCommand(serviceWorker, target, "resize-custom-2")
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("!")
    expect(await getTitle(serviceWorker, target)).toContain("custom size 2")
    // 理由の表示はバッジと一緒に消え、拡張機能の名前に戻る
    await expect
      .poll(() => getTitle(serviceWorker, target), { timeout: 5_000 })
      .toBe("Window & Viewport Resizer")

    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({
        "custom-sizes": JSON.stringify([
          {
            id: "custom-window-1",
            label: "Mine",
            width: 900,
            height: 650,
            mode: "window"
          }
        ])
      })
    )
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    const row = options.locator('[data-command="resize-custom-2"]')
    await expect(row.locator("option")).toHaveCount(2)
    await row.locator("select").selectOption("custom-window-1")
    await expect(options.getByText("Settings saved.")).toBeVisible()

    await runCommand(serviceWorker, target, "resize-custom-2")
    await expect
      .poll(() => getWindowSize(serviceWorker, target))
      .toEqual({ width: 900, height: 650 })

    // 枠は保存したまま、サイズを消すと空き枠と同じになる
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({ "custom-sizes": JSON.stringify([]) })
    )
    await runCommand(serviceWorker, target, "resize-custom-2")
    await expect.poll(() => getTitle(serviceWorker, target)).toContain("custom size 2")
  })

  test("撮影の保存: 指定のページを撮ってダウンロードする", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    await recordDownloadRequests(serviceWorker)
    await runCommand(serviceWorker, target, "capture-visible-download")
    await expect
      .poll(() => getDownloadRequests(serviceWorker))
      .toEqual([expect.stringMatching(/^Captures\/screenshot_.*\.png$/)])
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("OK")
  })

  test("撮影のコピー: ページ側でクリップボードに書き、結果をバッジに出す", async ({
    context,
    openTarget,
    serviceWorker
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const target = await openTarget("/")
    await recordDownloadRequests(serviceWorker)
    await runCommand(serviceWorker, target, "capture-visible-copy")
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("OK")
    const types = await target.evaluate(async () => {
      const items = await navigator.clipboard.read()
      return [...items[0].types]
    })
    expect(types).toContain("image/png")
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })

  test("範囲選択: 候補があれば選択 UI を出し、なければ ! で知らせる", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/picker")
    await runCommand(serviceWorker, target, "capture-pick")
    await expect
      .poll(() =>
        target.evaluate(() =>
          Array.from(document.documentElement.children).some(
            (el) => (el as HTMLElement).shadowRoot !== null
          )
        )
      )
      .toBe(true)

    const short = await openTarget("/")
    await runCommand(serviceWorker, short, "capture-pick")
    await expect.poll(() => getBadge(serviceWorker, short)).toBe("!")
  })

  test("拡大中のページ: 拡大率を変えず、確認も出さずにリサイズする", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const tabId = await serviceWorker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      await chrome.tabs.setZoom(tab.id as number, 1.5)
      return tab.id as number
    }, target.url())
    target.once("dialog", () => {
      throw new Error("確認は出さない")
    })

    await runCommand(serviceWorker, target, "resize-preset-svga")
    await expect
      .poll(() => getWindowSize(serviceWorker, target))
      .toEqual({ width: 800, height: 600 })
    expect(await serviceWorker.evaluate((id) => chrome.tabs.getZoom(id), tabId)).toBe(1.5)
  })

  test("設定画面: 割り当ての案内があり、今の割り当てを未設定と表示する", async ({
    context,
    extensionId
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await expect(options.locator(".shortcut-row")).toHaveCount(21)
    await expect(options.locator(".shortcut-unset")).toHaveCount(21)
    await expect(options.locator('[data-command="resize-preset-hd"]')).toContainText(
      "Resize: HD (1280 x 720)"
    )
    const [opened] = await Promise.all([
      context.waitForEvent("page"),
      options.getByRole("button", { name: "Open Chrome's shortcuts page" }).click()
    ])
    await expect.poll(() => opened.url()).toMatch(/^chrome:\/\/extensions\/shortcuts/)
  })
})
