import { expect, test } from "./fixtures"

test.describe("ポップアップのUI（アイコンボタン・共有・高さ）", () => {
  test("スクリーンショット欄は「表示部分」「ページ全体」の2行で、各行にダウンロードとコピーのボタンがある", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))

    const rows = popup.locator(".capture-row")
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText("Visible area")
    await expect(rows.nth(1)).toContainText("Full page")
    for (let i = 0; i < 2; i++) {
      await expect(rows.nth(i).locator("button.icon-button")).toHaveCount(2)
      // 範囲アイコン（左）+ ボタン2つ（右）
      await expect(rows.nth(i).locator(".capture-scope svg")).toHaveCount(1)
    }
  })

  test("すべてのアイコンボタン・共有ボタンに title と aria-label があり、色は currentColor で指定される", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))

    const targets = popup.locator("button.icon-button, a.share-button")
    // 描画完了を待ってから数える（アイコンボタン4つ + 共有ボタン1つ）
    await expect(targets).toHaveCount(5)
    for (const el of await targets.all()) {
      const title = await el.getAttribute("title")
      const label = await el.getAttribute("aria-label")
      expect(title).toBeTruthy()
      expect(label).toBeTruthy()
    }

    // SVG はインライン展開され、stroke は currentColor（CSS の color で着色）
    await expect(popup.locator(".capture-row svg")).toHaveCount(6)
    const strokes = await popup
      .locator(".capture-row svg")
      .evaluateAll((svgs) => svgs.map((s) => s.getAttribute("stroke")))
    expect(strokes.length).toBe(6)
    expect(new Set(strokes)).toEqual(new Set(["currentColor"]))
  })

  test("Xで共有ボタン: 共有であると分かる表示で、投稿画面（intent）のURLに本文が含まれる", async ({
    openTarget,
    openPopup
  }) => {
    const popup = await openPopup(await openTarget("/"))
    const share = popup.locator("a.share-button")

    await expect(share).toContainText("Share on X")
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
      (await popup.locator("a.share-button").getAttribute("href")) ?? ""
    const text = new URL(href).searchParams.get("text") ?? ""
    expect(text).toContain("#Chrome拡張機能 #Web制作")
    expect(text).toContain("このサイズだとどう見える")
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
