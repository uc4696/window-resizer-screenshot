# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語

- コード内コメント、README、コミットメッセージ、PR・Issue の文面はすべて日本語で書く。
- ブランチ名だけは英語（`feature/...` / `fix/...` / `test/...`）。

## Git 運用

- セッション開始時は `git status` と `git log -n 5 --oneline` で現在のブランチと文脈を確認する。
- `main` 上でコード変更を頼まれたら、書き換える前に新しいブランチを作るか確認する。勝手に `main` や無関係なブランチへ切り替えない。
- 変更は PR 経由で `main` にマージする運用。ただし CLAUDE.md などの開発用ドキュメントの整理は、履歴を公開する意味が薄いので `main` で直接行う。

## コマンドと注意点

- Windows + npm 11 以降ではネイティブモジュールのインストールスクリプトがブロックされ、`plasmo build` が `Bindings not found.` で失敗する。`npm install` の後は毎回 `npm rebuild` を実行する。
- 型チェック: `npx tsc --noEmit`（i18n の `messages.ja.ts` は `messages.en.ts` と同じキーを型で必須にしているので、文言の追加漏れもここで検出される）。
- E2E は `build/chrome-mv3-prod` を読み込むので、先に `npm run build` が必要。ブラウザは `npm run test:install-browser`（`.chrome-for-testing/` に取得、Beta は `CHROME_CHANNEL=beta`）。実ウィンドウを操作するため直列実行で、実行中はブラウザが実際に開く。
- 整形は Prettier（`printWidth` 90・セミコロンなし・ダブルクォート・末尾カンマなし・2スペース）。全体は `npm run format`。Markdown は README の表を崩さないよう対象外。Lint は `npm run lint`（ESLint flat config: `eslint.config.mjs`）。
- `.plasmo/` と `build/` は生成物なので編集しない。
- Plasmo のエントリファイル（`popup.tsx` / `options.tsx` / `background.ts`）は `src/` 配下に置く（`~*` → `./src/*`）。`assets/` はルートのまま。

## 実装上の注意

- 権限（`package.json` の `manifest.permissions`）は最小限に保つ。現在は `activeTab` / `storage` / `downloads` / `scripting` のみで、`host_permissions`・`tabs`・`clipboardWrite` は意図的に使っていない。追加が必要なら事前に相談する。E2E はビルド成果物の複製に `host_permissions` を足して読み込んでいるだけで、配布物は変更しない。
- Manifest V3 の現行仕様に沿い、非推奨 API や古いライブラリを持ち込まない。API キー等をハードコードしない。
- 絵文字はビルドで壊れるため、ソースに直書きせず `String.fromCodePoint` を使う（i18n 辞書内は `\uXXXX` 表記になっても可）。
- UI 文言は `en` / `ja` の両方の辞書に追加し、`t()` / `useI18n()` 経由で使う。拡張機能名・説明は `assets/_locales/{en,ja}/messages.json`。

## 機能別の仕様

新機能の追加や仕様変更をしたら、この節の該当項目を更新・追記する。

- **ページ全体の撮影**: 通常は window をスクロールして撮る。ページ自体がスクロールしない（`scrollHeight <= innerHeight`）ときは、表示面積が最大のスクロール要素を探し、ビューポート面積の70%以上（`MAIN_SCROLLER_MIN_RATIO`）を占めるときだけ目印 `data-wvr-scroll-target` を付けてその要素を撮る。70%未満なら伸ばさず従来どおり（結果は1画面）。既定は要素の表示領域だけを切り出した画像（area）。設定 `scrollAreaIncludeFrame` が有効なら、最初の1画面の外枠（範囲より上・左右）を残して範囲の中身を伸ばし、範囲より下の部分を最後に付け足す（framed、左右の外枠は1画面分だけ）。fixed/sticky を隠すときは、スクロール要素を含む要素（自身・fixed の親）は対象外にする。スクロールはページ側の `scroll-behavior: smooth` に負けないよう `behavior: "instant"` で行い、撮影後は元の位置に戻して目印を外す（`src/lib/screenshot.ts`）。実例は des.jointfb.com（`div.h-screen.overflow-x-hidden` が本文をスクロールする。FireShot も同じく div だけを撮る）。
- **範囲を選んで撮影**: 「ページ全体」の行の［選択］（click アイコン）は、幅120px・高さ80px以上で画面内に見えているスクロール要素があるときだけ押せる（popup 表示時に `countPickCandidates` で数える）。押すとページに選択 UI（Shadow DOM、`src/lib/picker.ts` の `scrollAreaPicker` を `executeScript` で注入、自己完結させる）を出して popup を閉じる。候補を破線枠で示し、カーソル下のいちばん内側の候補を強調、クリックでその位置に［ダウンロード］［コピー］［キャンセル］を出す。表示部分の行には［選択］と同じ幅の空き（`.icon-button-spacer`）を置き、ダウンロード／コピーを上下で揃える。選択中はページ側のクリック等を止める。Esc でいつでも中止。押されたら UI を消して要素に目印を付け、`mode: "picked"` で background に依頼する（撮り方は自動判定と同じ area / framed）。コピーはページ側で `ClipboardItem` に Promise を渡し、結果は `capture-badge` メッセージでバッジに出す。http のページ等クリップボード API が使えないときはコピーを出さない。background は拡張機能のページ以外から来た依頼では送信元タブを対象にする。
- **保存形式**: PNG（既定）/ WebP / JPEG を設定画面で選択（選択した時点で保存）。タイル撮影は常に PNG で行い、最終出力時だけ形式を変換する（`src/lib/screenshot.ts`）。`Settings.imageFormat` の不正値は `png` に正規化する。
- **保存（ダウンロード）**: 押下すると background が受け付けた時点で応答し、popup はすぐ閉じる。撮影・保存は background で続行し、結果は対象タブのツールバーアイコンのバッジで知らせる（撮影中 `...`・成功 `OK`・失敗 `!`、結果は3秒で消える。`src/background.ts`）。受け付け自体に失敗したときだけ popup を閉じずにエラーを表示する。
- **クリップボード**: 保存形式によらず常に PNG。`clipboardWrite` 権限は使わず、popup 側で `ClipboardItem` に Promise を渡す（`src/components/CaptureSection.tsx`）。そのためコピー完了までは popup を閉じない。成功時は check アイコンを出し、0.8秒後に popup を閉じる。失敗時は閉じずにエラーを表示する。
- **X 共有**: `https://x.com/intent/post?text=...` を新規タブで開く（権限不要）。本文は `src/lib/share.ts` で組み立て、文言とハッシュタグは i18n（ja: `#Chrome拡張機能 #Web制作` / en: `#ChromeExtension #WebDev`）。
- **アイコン**: Tabler Icons（MIT）の `icons/*.svg` を `data-text:` でインライン展開する（`src/components/Icon.tsx`）。
  - Plasmo のビルドで SVG の `viewBox` が除去され、width/height を変えても縮小されず見切れる。そのため Icon.tsx で `viewBox="0 0 24 24"` を補い、width/height を `size` に書き換える。SVG 内の class（`icon ...`）は読み込み時に除去し、ラッパーのクラスは `.ui-icon`。
  - 線画（outline）: screenshot / viewport-tall / download / copy / check / settings / click。brand-x だけは細線だと小サイズで欠けるため塗りつぶし（filled）。
  - サイズは既定 16px、フッターボタン内は 12px。
  - ライセンスは `licenses/LICENSE-tabler.txt`。設定画面に「Icons: Tabler Icons (MIT License)」と表記する。
- **サイズ基準の記憶**: 最後に選んだサイズ基準（window / viewport）を local ストレージのキー `size-mode` に保存し、ポップアップ表示時に復元する（`src/lib/storage.ts` の `getSizeMode` / `setSizeMode`、`src/popup.tsx` の `changeMode`）。不正値・未設定は window に正規化し、ファクトリーリセットで削除する。
- **フッターボタン**: 「設定を開く」と「X で共有」は共通クラス `.footer-button`（枠線付きの pill 型、アイコン + 文字）で同じデザインにする。`.popup-footer-row` で中央寄せ、間隔は 6px。
- **ポップアップの高さ**: 初期状態でスクロールが出ないよう余白を詰めるが、`.popup-root` の `max-height: 560px` / `overflow-y: auto` は外さない。日本語のフォールバックフォントは行高 `normal` が大きく ja だけはみ出したため、`body` の `line-height` を 1.35 に固定している（計測値: en 546px / ja 552px）。E2E で en / ja とも初期状態でスクロールが出ないことを確認している。

## バージョン・リリース

- 作業中は `package.json` の `version` を変更しない。全実装と確認が終わり、完了を報告する直前に1回だけ上げる（バグ修正・微調整は PATCH、機能追加は MINOR、全面刷新・権限の大幅変更は MAJOR）。
- `version` は必ず3桁の整数（`MAJOR.MINOR.PATCH`）。プレリリース表記や4桁は Plasmo のビルドエラーになるので禁止。ベータ版であることは ZIP 名・README・Git タグで表す（`window-resizer-screenshot-v0.2.1-beta.2.zip`）。
- ドキュメントのみの変更ではバージョン更新もビルドも不要。

## README

- `README.md` と `README.en.md` は常に両方を同じ内容で更新する。公開向けの文書なので、進捗ログや ToDo を書かない。
- 構成と順序を崩さない: 概要 → バグ報告（GitHub Issues へのリンク）→ 技術スタック/ディレクトリ構成 → インストール・開発手順 → 仕様と制約事項 → Changelog（表形式、最新を最上部に追記）→ ライセンス（商用利用・再配布・転売の禁止、個人利用は自由）。
- 最下部の「開発を応援する」（英語版は Support development）セクションと `.github/funding.yml` は維持する。
