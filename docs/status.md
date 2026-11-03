# 現在の状態

最終更新：2026-11-03
書き方は `F:\claude\hq\docs\status-format.md` に従う。

## 人の確認待ち
- 0.4.0 のストア審査の状況を確かめる
  - アップロードと「審査のため送信」は人が行う（`/publish` の手順2）。送信済みかどうかはリポジトリからはわからない
  - ダッシュボード: https://chrome.google.com/webstore/devconsole （アイテム ID `kaikockbajglbkgoeepfbamdknadhiji`）
- LP（固定ページ 10268／10273）の 0.4.0 反映を確かめて Republish する
  - 文案は `store/lp/0.4.0.md`、本文の正本は `store/lp/page.{ja,en}.html`
  - 反映後は本番の本文と `store/lp/page.*.html` が一致するか確かめる（`/publish` の手順3-6）

## 作業中
- なし

## 日付待ち
- なし

## 定期タスク
| 名前 | 動く場所 | いつ | 前回 | 確かめ方 |
| --- | --- | --- | --- | --- |
| E2E（Chrome Beta） | GitHub Actions | 毎日 03:00 | 2026-11-03 OK | `gh run list --workflow e2e-beta.yml -L 3`。失敗時は `e2e-failure` ラベルの Issue が立つ |

## 後でやりたいこと
- なし

## メモ
- 現在の版は 0.4.0（タグ `v0.4.0-beta.1`）。開いている PR・Issue はなし（2026-11-03 時点）
