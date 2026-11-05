import type { Worker } from "@playwright/test"

import { expect, test, type Page } from "./fixtures"
import {
  getDownloadRequests,
  recordDownloadRequests,
  waitForPopupClosed
} from "./helpers"

function getBadge(serviceWorker: Worker, target: Page) {
  return serviceWorker.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url })
    return chrome.action.getBadgeText({ tabId: tab.id })
  }, target.url())
}

/** バッジの文字が出た順に記録する。 */
async function recordBadges(serviceWorker: Worker) {
  await serviceWorker.evaluate(() => {
    const g = globalThis as unknown as { __badges: string[] }
    g.__badges = []
    const original = chrome.action.setBadgeText.bind(chrome.action)
    chrome.action.setBadgeText = ((details: { text?: string }) => {
      if (details.text) g.__badges.push(details.text)
      return original(details as chrome.action.BadgeTextDetails)
    }) as typeof chrome.action.setBadgeText
  })
}

function getBadges(serviceWorker: Worker) {
  return serviceWorker.evaluate(
    () => (globalThis as unknown as { __badges: string[] }).__badges
  )
}

async function runCommand(serviceWorker: Worker, target: Page, name: string) {
  await target.bringToFront()
  await target.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 200)))
      )
  )
  await serviceWorker.evaluate(
    async ({ name, url }) => {
      const [tab] = await chrome.tabs.query({ url })
      const { __commandListeners } = globalThis as unknown as {
        __commandListeners: ((name: string, tab: chrome.tabs.Tab) => void)[]
      }
      __commandListeners.forEach((listener) => listener(name, tab))
    },
    { name, url: target.url() }
  )
}

test.describe("遅延撮影タイマー", () => {
  test("popup: 3秒を選んで保存すると popup が閉じ、カウントダウンのあとで保存する", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    const popup = await openPopup(target)
    await recordDownloadRequests(serviceWorker)
    await recordBadges(serviceWorker)

    await popup.locator(".capture-delay select").selectOption("3")
    // タイマーではコピーと範囲選択を使えない
    const visible = popup.locator('.capture-row[data-capture-mode="visible"]')
    await expect(visible.getByRole("button", { name: /Copy/ })).toBeDisabled()
    await expect(
      popup.getByRole("button", { name: "Choose a scrollable area to capture" })
    ).toBeDisabled()

    await target.bringToFront()
    await visible.getByRole("button", { name: /Download/ }).click()
    await waitForPopupClosed(popup)
    await target.bringToFront()

    await expect.poll(() => getBadge(serviceWorker, target)).toMatch(/^[123]$/)
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
    await expect
      .poll(() => getDownloadRequests(serviceWorker), { timeout: 8_000 })
      .toEqual([expect.stringMatching(/^Captures\/screenshot_.*\.png$/)])
    await expect.poll(() => getBadge(serviceWorker, target)).toBe("OK")
    expect(await getBadges(serviceWorker)).toEqual(["3", "2", "1", "...", "OK"])
  })

  test("popup: 開き直すとタイマーはなしに戻る", async ({ openTarget, openPopup }) => {
    const target = await openTarget("/")
    let popup = await openPopup(target)
    await popup.locator(".capture-delay select").selectOption("10")
    await popup.close()
    popup = await openPopup(target)
    await expect(popup.locator(".capture-delay select")).toHaveValue("0")
  })

  test("ショートカット: 3秒待って表示部分を保存する", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    await recordDownloadRequests(serviceWorker)
    await runCommand(serviceWorker, target, "capture-visible-delay-3")
    await expect.poll(() => getBadge(serviceWorker, target)).toMatch(/^[123]$/)
    await expect
      .poll(() => getDownloadRequests(serviceWorker), { timeout: 8_000 })
      .toHaveLength(1)
  })

  test("待っている間にタブを切り替えると撮らず、! で知らせる", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    await recordDownloadRequests(serviceWorker)
    await recordBadges(serviceWorker)
    await runCommand(serviceWorker, target, "capture-visible-delay-3")
    const other = await openTarget("/long")
    await other.bringToFront()

    await expect.poll(() => getBadges(serviceWorker), { timeout: 8_000 }).toContain("!")
    expect(await getDownloadRequests(serviceWorker)).toEqual([])
  })

  test("同じタブでもう一度押すと、前のカウントダウンをやめて1枚だけ撮る", async ({
    openTarget,
    serviceWorker
  }) => {
    const target = await openTarget("/")
    await recordDownloadRequests(serviceWorker)
    await runCommand(serviceWorker, target, "capture-visible-delay-3")
    await runCommand(serviceWorker, target, "capture-visible-delay-3")
    await expect
      .poll(() => getDownloadRequests(serviceWorker), { timeout: 8_000 })
      .toHaveLength(1)
    await target.waitForTimeout(1500)
    expect(await getDownloadRequests(serviceWorker)).toHaveLength(1)
  })
})
