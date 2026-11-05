---
name: verify
description: 型チェック・本番ビルド・Playwright E2E を順に実行して変更を検証する。実装を終えて完了を報告する前や、ユーザーに「検証して」「テストして」と言われたときに使う。
---

プロジェクトルートで次を順に実行する。途中で失敗したらそこで止め、エラー内容と原因の見立てを日本語で報告する。

1. `npx tsc --noEmit` と `npm run lint`（lint は失敗しても止めずに結果を記録し、次へ進む）
2. `npm run build`
   - `Bindings not found.` で失敗したら `npm rebuild` を実行してからやり直す。
3. `npm run test:e2e:wsl`
   - WSL2 の Ubuntu と xvfb で実行するので、Windows の画面にブラウザは出ない。同期・ビルド・Chrome の取得まで WSL 側で行う。直列実行なので数分かかる。タイムアウトは長め（10分）に取り、バックグラウンドで実行する。
   - 特定の spec だけ確認したいときは `npm run test:e2e:wsl -- tests/e2e/<name>.spec.ts`。
   - 失敗時は Windows 側の `test-results/` に戻った trace・スクリーンショットのパスを報告に含める。
   - WSL で動かせないときや、Windows でだけ起きる問題を疑うときは、人に断ってから Windows で `npm run test:e2e` を実行する（`.chrome-for-testing/executable-path.txt` が無ければ先に `npm run test:install-browser`）。ブラウザが画面の前面に開くので、人の作業を止める。

最後に、各ステップの成否（失敗したテスト名を含む）を簡潔にまとめる。失敗を成功と報告しない。
