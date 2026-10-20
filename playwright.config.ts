import { defineConfig } from "@playwright/test"

const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./tests/e2e",
  // 拡張機能のテストは実ウィンドウを操作するため、直列実行にする
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI
    ? [
        ["list"],
        ["html", { open: "never" }],
        ["junit", { outputFile: "test-results/junit.xml" }]
      ]
    : [["list"]],
  outputDir: "test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
})
