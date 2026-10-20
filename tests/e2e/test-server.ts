import http from "node:http"
import type { AddressInfo } from "node:net"

/** 縦長ページの本体の高さ（px）。 */
export const LONG_PAGE_HEIGHT = 3000
/** ヘッダーの高さ（px）。ページ全体の高さは本体 + ヘッダーになる。 */
const HEADER_HEIGHT = 40
/** 縦長ページ全体の高さ（px）。フルページ撮影テストの期待値に使う。 */
export const LONG_PAGE_TOTAL_HEIGHT = LONG_PAGE_HEIGHT + HEADER_HEIGHT

const SHORT_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>E2E short page</title></head>
<body style="margin:0;background:#fff"><h1>E2E short page</h1></body></html>`

const LONG_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>E2E long page</title>
<style>
  body { margin: 0; background: #f5f5f5; }
  header { position: sticky; top: 0; height: ${HEADER_HEIGHT}px; background: #036; color: #fff; }
  .tall { height: ${LONG_PAGE_HEIGHT}px; background: linear-gradient(#fff, #9cf); }
</style></head>
<body><header>sticky header</header><div class="tall"></div></body></html>`

/** テスト用のローカルHTTPサーバーを起動する（空きポートを自動割り当て）。 */
export async function startTestServer(): Promise<{
  baseUrl: string
  close: () => Promise<void>
}> {
  const server = http.createServer((req, res) => {
    const body = req.url?.startsWith("/long") ? LONG_PAGE : SHORT_PAGE
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
