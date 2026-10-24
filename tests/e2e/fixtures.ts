import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker
} from "@playwright/test"

import { startTestServer } from "./test-server"

const ROOT = path.resolve(__dirname, "../..")
/** `npm run build` の出力先（Plasmo の本番ビルド） */
export const BUILD_PATH = path.resolve(ROOT, "build/chrome-mv3-prod")
const BROWSER_PATH_FILE = path.resolve(ROOT, ".chrome-for-testing/executable-path.txt")

/**
 * テストに使うChromeの実行ファイルを解決する。
 * 1. 環境変数 CHROME_PATH
 * 2. `npm run test:install-browser` が書き出した .chrome-for-testing/executable-path.txt
 */
function resolveChromePath(): string {
  const fromEnv = process.env.CHROME_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  if (existsSync(BROWSER_PATH_FILE)) {
    const p = readFileSync(BROWSER_PATH_FILE, "utf8").trim()
    if (existsSync(p)) return p
  }
  throw new Error(
    "Chrome for Testing が見つかりません。`npm run test:install-browser` を実行してください。"
  )
}

/**
 * テスト用に拡張機能のビルドを複製し、host_permissions だけを追加する。
 *
 * 製品の manifest は activeTab のみで、「ツールバーアイコンのクリック」という実ユーザー操作でしか
 * 権限が付与されない。自動テストではその操作を再現できないため、テスト用の複製にだけ
 * host_permissions を足す。配布物・本番ビルドは変更しない。
 */
function createTestExtension(workDir: string): string {
  if (!existsSync(path.join(BUILD_PATH, "manifest.json"))) {
    throw new Error("拡張機能のビルドがありません。`npm run build` を実行してください。")
  }
  const dest = path.join(workDir, "extension")
  cpSync(BUILD_PATH, dest, { recursive: true })
  const manifestPath = path.join(dest, "manifest.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  // captureVisibleTab は <all_urls> または activeTab が必要なため、テスト用複製にだけ <all_urls> を付与する
  manifest.host_permissions = ["<all_urls>"]
  writeFileSync(manifestPath, JSON.stringify(manifest))
  return dest
}

type TestFixtures = {
  context: BrowserContext
  serviceWorker: Worker
  extensionId: string
  /** 対象ページ（アクティブタブとして扱われる通常のWebページ）を開く */
  openTarget: (pathName?: string) => Promise<Page>
  /** 対象ページ向けの popup を別タブで開く */
  openPopup: (target: Page) => Promise<Page>
}

type WorkerFixtures = {
  server: { baseUrl: string }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await startTestServer()
      await use({ baseUrl: server.baseUrl })
      await server.close()
    },
    { scope: "worker" }
  ],

  // 拡張機能を読み込んだ永続コンテキスト（テストごとに新しいプロファイルを使う）
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const workDir = mkdtempSync(path.join(tmpdir(), "wvr-e2e-"))
    const extensionPath = createTestExtension(workDir)
    const context = await chromium.launchPersistentContext(
      path.join(workDir, "profile"),
      {
        executablePath: resolveChromePath(),
        // 拡張機能は headed（CI では xvfb 上）で実行する
        headless: false,
        viewport: null,
        acceptDownloads: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          // 画面文言の検証を安定させるため、UI言語を英語に固定する
          "--lang=en-US",
          "--no-first-run",
          "--no-default-browser-check"
        ]
      }
    )
    await use(context)
    await context.close()
    rmSync(workDir, { recursive: true, force: true })
  },

  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent("serviceworker")
    await use(worker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host)
  },

  openTarget: async ({ context, server }, use) => {
    await use(async (pathName = "/") => {
      const page = await context.newPage()
      await page.goto(`${server.baseUrl}${pathName}`)
      await page.bringToFront()
      return page
    })
  },

  openPopup: async ({ context, serviceWorker, extensionId }, use) => {
    await use(async (target: Page) => {
      // 対象ページを前面にし、そのタブ/ウィンドウIDを取得する（popup を作る前に取得する）
      await target.bringToFront()
      const info = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true
        })
        return { tabId: tab.id as number, windowId: tab.windowId }
      })

      const popup = await context.newPage()
      // popup 内の「アクティブタブ/現在のウィンドウ」の取得先だけを対象ページに差し替える。
      // （実運用では popup は対象タブ上に重なって表示されるため、その状態を再現する）
      await popup.addInitScript(({ tabId, windowId }) => {
        const origQuery = chrome.tabs.query.bind(chrome.tabs)
        chrome.tabs.query = ((queryInfo: chrome.tabs.QueryInfo) => {
          if (queryInfo?.active && queryInfo?.currentWindow) {
            return chrome.tabs.get(tabId).then((tab) => [tab])
          }
          return origQuery(queryInfo)
        }) as typeof chrome.tabs.query
        chrome.windows.getCurrent = (() =>
          chrome.windows.get(windowId)) as typeof chrome.windows.getCurrent
      }, info)
      await popup.goto(`chrome-extension://${extensionId}/popup.html`)
      return popup
    })
  }
})

export { expect }
export type { Page }
