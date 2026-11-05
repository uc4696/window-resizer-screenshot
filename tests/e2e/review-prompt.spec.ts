import type { Page, Worker } from "@playwright/test"

import { expect, test } from "./fixtures"
import { presetButton, waitForCaptureBadge, waitForFinalStatus } from "./helpers"

const DAY = 24 * 60 * 60 * 1000
/** ストアのレビューのページ。外部通信を避けるため、実際には開かず URL だけ確かめる */
const STORE_REVIEW_URL =
  "https://chromewebstore.google.com/detail/kaikockbajglbkgoeepfbamdknadhiji/reviews"

/** インストール日時と評価のお願いの状態を、試したい時点のものにする。 */
async function seed(
  serviceWorker: Worker,
  { installedDaysAgo, state }: { installedDaysAgo: number; state?: object }
): Promise<void> {
  await serviceWorker.evaluate(
    async ({ installedAt, state }) => {
      await chrome.storage.local.set({ installedAt })
      if (state) await chrome.storage.local.set({ reviewPrompt: state })
    },
    { installedAt: new Date(Date.now() - installedDaysAgo * DAY).toISOString(), state }
  )
}

async function readState(serviceWorker: Worker) {
  return serviceWorker.evaluate(async () => {
    const { reviewPrompt } = await chrome.storage.local.get("reviewPrompt")
    return reviewPrompt as
      | { pending: boolean; closed: boolean; rated?: boolean; postponedUntil?: number }
      | undefined
  })
}

async function resizeOnce(popup: Page): Promise<void> {
  await presetButton(popup, 800, 600).click()
  await expect(await waitForFinalStatus(popup)).toMatch(/^Resized/)
}

/** 印が付いた状態で popup を開く。 */
async function openWithPrompt(
  serviceWorker: Worker,
  openPopup: (target: Page) => Promise<Page>,
  target: Page
): Promise<Page> {
  await seed(serviceWorker, {
    installedDaysAgo: 10,
    state: { pending: true, closed: false }
  })
  return openPopup(target)
}

test.describe("評価のお願い", () => {
  test("インストールから 3 日たつ前のリサイズでは出ない", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    await seed(serviceWorker, { installedDaysAgo: 2 })
    const first = await openPopup(target)
    await resizeOnce(first)
    await first.close()

    expect((await readState(serviceWorker))?.pending ?? false).toBe(false)
    const second = await openPopup(target)
    await expect(second.locator(".mode-button").first()).toBeVisible()
    await expect(second.locator(".review-prompt")).toHaveCount(0)
  })

  test("service worker がインストール日時を記録する", async ({ serviceWorker }) => {
    await expect
      .poll(() =>
        serviceWorker.evaluate(async () => {
          const { installedAt } = await chrome.storage.local.get("installedAt")
          return typeof installedAt === "string" && !Number.isNaN(Date.parse(installedAt))
        })
      )
      .toBe(true)
  })

  test("3 日たったあとのリサイズの成功で印が付き、その場では出ず、次に開いたときに出る", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    await seed(serviceWorker, { installedDaysAgo: 3 })
    const first = await openPopup(target)
    await resizeOnce(first)
    await expect.poll(async () => (await readState(serviceWorker))?.pending).toBe(true)
    await expect(first.locator(".review-prompt")).toHaveCount(0)
    await first.close()

    const second = await openPopup(target)
    const prompt = second.locator(".review-prompt")
    await expect(prompt.locator("h2")).toHaveText("Is Window & Viewport Resizer helpful?")
    await expect(prompt).toContainText("Rate it on the Chrome Web Store.")
    await expect(prompt.locator(".review-rate")).toHaveText("Rate on the store")
    await expect(prompt.locator(".review-rate svg")).toHaveCount(1)
    await expect(prompt).toContainText("Buy me a drink!")
    await expect(prompt.locator("a.support-link img")).toBeVisible()
    await expect(prompt.locator(".review-secondary")).toHaveText([
      "Later",
      "Don't show again"
    ])
    // 見出しのすぐ下に大きく出し、本来の中身を押し下げる
    const heights = await prompt.evaluate((el) => {
      const below = document.querySelector(".current-size-section") as HTMLElement
      return {
        height: el.getBoundingClientRect().height,
        pushed: el.getBoundingClientRect().bottom <= below.getBoundingClientRect().top
      }
    })
    expect(heights.height).toBeGreaterThanOrEqual(400)
    expect(heights.pushed).toBe(true)
  })

  test("3 日たったあとの撮影の成功でも印が付く", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    await seed(serviceWorker, { installedDaysAgo: 3 })
    const popup = await openPopup(target)
    await target.bringToFront()
    await popup
      .locator('.capture-row[data-capture-mode="visible"] button.icon-button')
      .first()
      .click()
    expect(await waitForCaptureBadge(serviceWorker, popup, target)).toBe("OK")
    await expect.poll(async () => (await readState(serviceWorker))?.pending).toBe(true)
  })

  test("「あとで」で消え、3 日たつまではリサイズしても出ない", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openWithPrompt(serviceWorker, openPopup, target)
    await popup.getByRole("button", { name: "Later" }).click()
    await expect(popup.locator(".review-prompt")).toHaveCount(0)

    await expect
      .poll(async () => (await readState(serviceWorker))?.postponedUntil ?? 0)
      .toBeGreaterThan(Date.now() + 2 * DAY)
    expect((await readState(serviceWorker))?.pending).toBe(false)

    await resizeOnce(popup)
    await popup.close()
    expect((await readState(serviceWorker))?.pending).toBe(false)
  })

  test("「表示しない」のあとは、リサイズしても出ない", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openWithPrompt(serviceWorker, openPopup, target)
    await popup.getByRole("button", { name: "Don't show again" }).click()
    await expect(popup.locator(".review-prompt")).toHaveCount(0)
    await expect.poll(async () => (await readState(serviceWorker))?.closed).toBe(true)

    await resizeOnce(popup)
    await popup.close()
    expect((await readState(serviceWorker))?.pending).toBe(false)
    expect((await readState(serviceWorker))?.rated).toBeUndefined()

    const next = await openPopup(target)
    await expect(next.locator(".mode-button").first()).toBeVisible()
    await expect(next.locator(".review-prompt")).toHaveCount(0)
  })

  test("「ストアで評価する」はレビューのページを新しいタブで開き、rated を記録する", async ({
    serviceWorker,
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const popup = await openWithPrompt(serviceWorker, openPopup, target)
    await popup.evaluate(() => {
      const g = globalThis as unknown as { __created?: string[] }
      g.__created = []
      chrome.tabs.create = ((options: chrome.tabs.CreateProperties) => {
        g.__created?.push(options.url ?? "")
        return Promise.resolve({})
      }) as unknown as typeof chrome.tabs.create
    })

    await popup.locator(".review-rate").click()
    await expect(popup.locator(".review-prompt")).toHaveCount(0)
    const created = await popup.evaluate(
      () => (globalThis as unknown as { __created?: string[] }).__created
    )
    expect(created).toEqual([STORE_REVIEW_URL])
    await expect.poll(async () => (await readState(serviceWorker))?.rated).toBe(true)
    expect((await readState(serviceWorker))?.closed).toBe(true)
  })

  test("アップデートで「表示しない」が取り消され、評価した人はそのまま", async ({
    serviceWorker
  }) => {
    // 本物の読み込み直しでは Playwright が新しい service worker を検出できないので、
    // onInstalled を発火してリスナーのつなぎ込みを確かめる
    const fireUpdate = () =>
      serviceWorker.evaluate(() => {
        const event = chrome.runtime.onInstalled as unknown as {
          dispatch(details: { reason: string }): void
        }
        event.dispatch({ reason: "update" })
      })

    await seed(serviceWorker, {
      installedDaysAgo: 30,
      state: { pending: false, closed: true }
    })
    await fireUpdate()
    await expect.poll(async () => (await readState(serviceWorker))?.closed).toBe(false)
    expect((await readState(serviceWorker))?.postponedUntil ?? 0).toBeGreaterThan(
      Date.now() + 2 * DAY
    )

    await seed(serviceWorker, {
      installedDaysAgo: 30,
      state: { pending: false, closed: true, rated: true }
    })
    await fireUpdate()
    // リスナーの処理が終わるのを待ってから確かめる
    await serviceWorker.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))
    expect(await readState(serviceWorker)).toEqual({
      pending: false,
      closed: true,
      rated: true
    })
  })

  for (const language of ["en", "ja"] as const) {
    test(`文字とボタンが popup の幅からはみ出さない（${language}）`, async ({
      context,
      extensionId,
      serviceWorker,
      openTarget,
      openPopup
    }) => {
      if (language === "ja") {
        const options = await context.newPage()
        await options.goto(`chrome-extension://${extensionId}/options.html`)
        await options.locator("#language").selectOption("ja")
        await expect(options.getByText("設定を保存しました。")).toBeVisible()
        await options.close()
      }
      const popup = await openWithPrompt(serviceWorker, openPopup, await openTarget("/"))
      await popup.setViewportSize({ width: 320, height: 600 })
      const prompt = popup.locator(".review-prompt")
      await expect(prompt.locator(".review-rate")).toHaveText(
        language === "ja" ? "ストアで評価する" : "Rate on the store"
      )
      if (language === "ja") {
        await expect(prompt.locator("h2")).toHaveText(
          "Window & Viewport Resizer は役に立っていますか？"
        )
        await expect(prompt).toContainText("Chrome ウェブストアで評価する。")
        await expect(prompt).toContainText("ドリンク1杯ごちそうする！")
        await expect(prompt.locator(".review-secondary")).toHaveText([
          "あとで",
          "表示しない"
        ])
      }

      const metrics = await popup.locator(".popup-root").evaluate((root) => {
        const area = root.querySelector(".review-prompt") as HTMLElement
        const box = area.getBoundingClientRect()
        const inside = Array.from(area.querySelectorAll("h2, p, button, img")).every(
          (el) => {
            const r = el.getBoundingClientRect()
            return r.left >= box.left && r.right <= box.right
          }
        )
        return {
          inside,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          rate: (area.querySelector(".review-rate") as HTMLElement).offsetHeight,
          banner: (area.querySelector(".support-image") as HTMLElement).offsetHeight
        }
      })
      expect(metrics.inside).toBe(true)
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
      // ［ストアで評価する］とバナーは同じ大きさ
      expect(Math.abs(metrics.rate - metrics.banner)).toBeLessThanOrEqual(1)
    })
  }
})
