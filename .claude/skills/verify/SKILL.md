---
name: verify
description: 型チェック・本番ビルド・Playwright E2E を順に実行して変更を検証する。実装を終えて完了を報告する前や、ユーザーに「検証して」「テストして」と言われたときに使う。
---

プロジェクトルートで次を順に実行する。途中で失敗したらそこで止め、エラー内容と原因の見立てを日本語で報告する。

1. `npx tsc --noEmit` と `npm run lint`（lint は失敗しても止めずに結果を記録し、次へ進む）
2. `npm run build`
   - `Bindings not found.` で失敗したら `npm rebuild` を実行してからやり直す。
3. `.chrome-for-testing/executable-path.txt` が無ければ `npm run test:install-browser` を実行する（既定は Stable）。
4. `npm run test:e2e`
   - 実ブラウザが開き、直列実行なので数分かかる。タイムアウトは長め（10分）に取る。
   - 特定の spec だけ確認したいときは `npx playwright test tests/e2e/<name>.spec.ts`。
   - 失敗時は `test-results/` の trace・スクリーンショットのパスを報告に含める。

最後に、各ステップの成否（失敗したテスト名を含む）を簡潔にまとめる。失敗を成功と報告しない。
