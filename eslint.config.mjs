import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "build/",
      ".plasmo/",
      "node_modules/",
      ".chrome-for-testing/",
      "test-results/",
      "playwright-report/"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: reactHooks.configs.recommended.rules
  },
  {
    files: [
      "scripts/**/*.{js,mjs}",
      ".claude/hooks/**/*.mjs",
      "tests/**/*.ts",
      "*.config.{ts,mjs}"
    ],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" }
  }
)
