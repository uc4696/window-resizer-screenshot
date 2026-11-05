import { expect, test } from "./fixtures"

test.describe("ポップアップのUI（アイコンボタン・共有・高さ）", () => {
  test("スクリーンショット欄は「表示部分」「ページ全体」の2行で、各行にダウンロードとコピー、ページ全体の行には範囲選択のボタンもある", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))

    const rows = popup.locator(".capture-row[data-capture-mode]")
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText("Visible area")
    await expect(rows.nth(1)).toContainText("Full page")
    // 表示部分: ダウンロード・コピー / ページ全体: ダウンロード・コピー・範囲選択
    await expect(rows.nth(0).locator("button.icon-button")).toHaveCount(2)
    await expect(rows.nth(1).locator("button.icon-button")).toHaveCount(3)
    for (let i = 0; i < 2; i++) {
      // 範囲アイコン（左）
      await expect(rows.nth(i).locator(".capture-scope svg")).toHaveCount(1)
    }
    // 表示部分の行は［選択］の分を空けて、ダウンロード・コピーが上下で同じ位置に並ぶ
    const lefts = await rows.evaluateAll((els) =>
      els.map((row) =>
        Array.from(row.querySelectorAll("button.icon-button"))
          .slice(0, 2)
          .map((b) => Math.round(b.getBoundingClientRect().left))
      )
    )
    expect(lefts[0]).toEqual(lefts[1])
  })

  test("すべてのアイコンボタン・共有ボタンに title と aria-label があり、色は currentColor で指定される", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))

    const targets = popup.locator("button.icon-button, a.share-button")
    // 描画完了を待ってから数える（アイコンボタン5つ + 共有ボタン7つ）
    await expect(targets).toHaveCount(12)
    for (const el of await targets.all()) {
      const title = await el.getAttribute("title")
      const label = await el.getAttribute("aria-label")
      expect(title).toBeTruthy()
      expect(label).toBeTruthy()
    }

    // SVG はインライン展開され、stroke は currentColor（CSS の color で着色）
    await expect(popup.locator(".capture-row[data-capture-mode] svg")).toHaveCount(7)
    const strokes = await popup
      .locator(".capture-row[data-capture-mode] svg")
      .evaluateAll((svgs) => svgs.map((s) => s.getAttribute("stroke")))
    expect(strokes.length).toBe(7)
    expect(new Set(strokes)).toEqual(new Set(["currentColor"]))
  })

  test("Xで共有ボタン: 共有であると分かる表示で、投稿画面（intent）のURLに本文が含まれる", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const share = popup.locator('a.share-button[data-share="x"]')

    await expect(share).toHaveAttribute("title", /X/)
    await expect(share).toHaveAttribute("target", "_blank")
    await expect(share).toHaveAttribute("rel", /noopener/)

    const href = (await share.getAttribute("href")) ?? ""
    const url = new URL(href)
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post")
    const text = url.searchParams.get("text") ?? ""
    expect(text).toContain("Window & Viewport Resizer")
    expect(text).toContain(
      "https://chromewebstore.google.com/detail/kaikockbajglbkgoeepfbamdknadhiji"
    )
    expect(text).toContain("#ChromeExtension")
  })

  test("共有先: 7 つの SNS が新規タブで開き、ツールチップに名前がある", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const links = popup.locator(".footer-links a.share-button")
    await expect(links).toHaveCount(7)
    const info = await links.evaluateAll((els) =>
      els.map((el) => ({
        id: el.getAttribute("data-share"),
        host: new URL((el as HTMLAnchorElement).href).host,
        target: el.getAttribute("target"),
        rel: el.getAttribute("rel"),
        title: el.getAttribute("title"),
        svg: el.querySelectorAll("svg").length,
        top: Math.round(el.getBoundingClientRect().top)
      }))
    )
    expect(info.map((i) => i.host)).toEqual([
      "x.com",
      "www.facebook.com",
      "social-plugins.line.me",
      "www.threads.com",
      "bsky.app",
      "www.linkedin.com",
      "www.reddit.com"
    ])
    for (const item of info) {
      expect(item.target).toBe("_blank")
      expect(item.rel).toContain("noopener")
      expect(item.svg).toBe(1)
      expect(item.top).toBe(info[0].top)
    }
    expect(info[2].title).toContain("LINE")
  })

  test("カスタムサイズのラベルにもアイコンがある", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({
        "custom-sizes": JSON.stringify([
          { id: "c1", label: "Mine", width: 900, height: 650, mode: "window" }
        ])
      })
    )
    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Window-based" }).click()
    await expect(
      popup.locator(".custom-size-section .preset-group-title svg")
    ).toHaveCount(1)
  })

  test("寄付の下の行に、左に X、右に設定がアイコンで並び、説明はツールチップにある", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const share = popup.locator('.popup-footer-row .share-button[data-share="x"]')
    const settings = popup.locator(".popup-footer-row .options-link")
    await expect(settings).toHaveAttribute("title", /settings/)
    await expect(share.locator("svg")).toHaveCount(1)
    await expect(settings.locator("svg")).toHaveCount(1)
    await expect(share).toHaveText("")
    await expect(settings).toHaveText("")

    const rect = (selector: string) =>
      popup.evaluate((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }, selector)
    const root = await rect(".popup-root")
    const x = await rect(".popup-footer-row .share-button")
    const gear = await rect(".popup-footer-row .options-link")
    const support = await rect(".support-section")
    expect(x.top).toBeGreaterThanOrEqual(support.bottom)
    expect(x.left - root.left).toBeLessThan(20)
    expect(root.right - gear.right).toBeLessThan(20)
  })

  test("今のサイズと同じプリセットとカスタムサイズを強調する", async ({
    openTarget,
    openPopup,
    serviceWorker
  }) => {
    await serviceWorker.evaluate(() =>
      chrome.storage.local.set({
        "custom-sizes": JSON.stringify([
          { id: "c1", label: "Same", width: 800, height: 600, mode: "window" },
          { id: "c2", label: "Other", width: 900, height: 600, mode: "window" }
        ])
      })
    )
    const popup = await openPopup(await openTarget("/"))
    await popup.getByRole("button", { name: "Window-based" }).click()
    await popup.locator('button.preset-button[data-size="800x600"]').click()
    const current = popup.locator('button.preset-button[aria-current="true"]')
    await expect(current).toHaveCount(1)
    await expect(current).toHaveAttribute("data-size", "800x600")
    await expect(popup.locator('.custom-size-apply[aria-current="true"]')).toHaveText(
      /Same/
    )
  })

  test("リサイズの成功はメッセージを見せないが、エラーは見せる", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const status = popup.locator(".status-text")
    await popup.getByRole("button", { name: "Window-based" }).click()
    await popup.locator('button.preset-button[data-size="800x600"]').click()
    await expect(status).toHaveText("Resized to 800 x 600.")
    await expect(status).toHaveClass(/is-quiet/)
    const box = await status.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(1)
  })

  test("見た目: プリセットは同じ大きさ、角なし、タイマーは撮影の行の最後", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const sizes = await popup.locator("button.preset-button").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return `${Math.round(r.width)}x${Math.round(r.height)}`
      })
    )
    expect(sizes).toHaveLength(8)
    expect(new Set(sizes).size).toBe(1)

    const radius = await popup
      .locator("button:not(.delay-option), select, input, .current-size-section")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopLeftRadius))
    expect(new Set(radius)).toEqual(new Set(["0px"]))

    // タイマーはすき間なしでつながり、両端の外側だけが丸い
    const delay = await popup.locator(".delay-option").evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          tl: s.borderTopLeftRadius,
          tr: s.borderTopRightRadius
        }
      })
    )
    expect(delay).toHaveLength(4)
    for (let i = 1; i < 4; i++) expect(delay[i].left).toBe(delay[i - 1].right)
    expect(delay[0].tl).not.toBe("0px")
    expect(delay[0].tr).toBe("0px")
    expect(delay[1].tl).toBe("0px")
    expect(delay[3].tl).toBe("0px")
    expect(delay[3].tr).not.toBe("0px")

    const order = await popup
      .locator(".capture-section .capture-row")
      .evaluateAll((els) => els.map((el) => el.className))
    expect(order[2]).toContain("capture-timer-row")
    await expect(popup.locator(".capture-row")).toHaveCount(3)
  })

  test("プリセットは短い名前の SVG で、詳しいサイズはツールチップにある。今のサイズは1行で押せない", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const hd = popup.locator('button.preset-button[data-size="1280x720"]')
    await expect(hd.locator("svg text")).toHaveText("720p")
    await expect(hd).toHaveAttribute("title", "HD (1280×720)")
    await expect(
      popup.locator('button.preset-button[data-size="640x480"] svg text')
    ).toHaveText("VGA")

    const items = popup.locator(".current-size-section .size-item")
    await expect(items).toHaveCount(2)
    const tops = await items.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    )
    expect(tops[0]).toBe(tops[1])
    await expect(popup.locator(".current-size-section button")).toHaveCount(0)
  })

  test("アイコンは枠からはみ出さず、SVGに viewBox がある（縮小されて枠に収まる）", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    // 今のサイズ2 + 基準2 + 比率2 + カスタムの見出しと＋2 + 撮影の見出し1 + タイマー1 + 行頭アイコン2
    // + ダウンロード/コピー4 + 範囲選択1 + 共有7 + 設定1
    await expect(popup.locator(".ui-icon")).toHaveCount(25)

    const results = await popup.locator(".ui-icon").evaluateAll((icons) =>
      icons.map((icon) => {
        const svg = icon.querySelector("svg") as SVGSVGElement
        const svgRect = svg.getBoundingClientRect()
        const iconRect = icon.getBoundingClientRect()
        // 親ボタン（なければ行頭アイコンのラッパー）の枠
        const frame = (
          icon.closest(
            "button, a, .capture-scope, .size-item, .preset-group-title, .section-title"
          ) ?? icon
        ).getBoundingClientRect()
        const tolerance = 0.5
        return {
          hasViewBox: svg.getAttribute("viewBox") === "0 0 24 24",
          sizeMatches:
            Math.abs(svgRect.width - iconRect.width) <= tolerance &&
            Math.abs(svgRect.height - iconRect.height) <= tolerance,
          insideFrame:
            svgRect.left >= frame.left - tolerance &&
            svgRect.top >= frame.top - tolerance &&
            svgRect.right <= frame.right + tolerance &&
            svgRect.bottom <= frame.bottom + tolerance
        }
      })
    )
    for (const r of results) {
      expect(r.hasViewBox).toBe(true)
      expect(r.sizeMatches).toBe(true)
      expect(r.insideFrame).toBe(true)
    }
  })

  test("最後に選択したサイズ基準（Viewport-based）がポップアップを開き直しても維持される", async ({
    openTarget,
    openPopup
  }) => {
    const target = await openTarget("/")
    const first = await openPopup(target)
    await first.locator(".mode-button", { hasText: "Viewport" }).click()
    await expect(first.locator(".mode-button.active")).toContainText("Viewport")
    await first.close()

    const second = await openPopup(target)
    await expect(second.locator(".mode-button.active")).toContainText("Viewport")
  })

  test("言語を日本語にすると、共有の投稿文が日本語のハッシュタグ付きになる", async ({
    context,
    extensionId,
    openTarget,
    openPopup
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#language").selectOption("ja")
    await expect(options.getByText("設定を保存しました。")).toBeVisible()

    const popup = await openPopup(await openTarget("/"))
    const href =
      (await popup.locator('a.share-button[data-share="x"]').getAttribute("href")) ?? ""
    const text = new URL(href).searchParams.get("text") ?? ""
    expect(text).toContain("#Chrome拡張機能 #Web制作")
    expect(text).toContain("このサイズだとどう見える")
  })

  test("日本語表示でも、カスタムサイズ未登録の初期状態ではスクロールが出ない", async ({
    context,
    extensionId,
    openTarget,
    openPopup
  }) => {
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html`)
    await options.locator("#language").selectOption("ja")
    await expect(options.getByText("設定を保存しました。")).toBeVisible()

    const popup = await openPopup(await openTarget("/"))
    await popup.setViewportSize({ width: 320, height: 600 })
    await expect(popup.locator(".mode-button").first()).toHaveText("ウィンドウ")

    const metrics = await popup.locator(".popup-root").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    }))
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight)
  })

  test("初期状態ではスクロールなしで全体が表示される（スクロール自体は無効化していない）", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    // Chrome のポップアップと同じ幅・高さ上限（幅は拡張機能側の300px、高さ上限600px）
    await popup.setViewportSize({ width: 320, height: 600 })

    const metrics = await popup.locator(".popup-root").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY
    }))
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight)
    expect(metrics.clientHeight).toBeLessThanOrEqual(600)
    // 狭い環境・高さが足りない環境でスクロールできるよう、overflow は auto のまま
    expect(metrics.overflowY).toBe("auto")
  })
})
