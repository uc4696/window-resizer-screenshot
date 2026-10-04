# Window & Viewport Resizer (Chrome拡張機能)

**日本語** | [English](README.en.md)

> **現在のバージョン: `0.1.0`（ベータ版 `0.1.0-beta.1`）**

ウィンドウサイズ／ビューポートサイズを指定テンプレートやカスタムサイズにリサイズし、表示部分・ページ全体のスクリーンショットを撮影してダウンロードできるChrome拡張機能（Manifest V3 / Plasmoフレームワーク）です。

## 概要

- ウィンドウサイズ・ビューポートサイズの両方に対応したリサイズ機能
- アスペクト比別の解像度テンプレート（16:9: HD/FHD/WQHD/4K、4:3: VGA/SVGA/XGA/UXGA）
- テンプレートごと・モード（ウィンドウ基準／ビューポート基準）ごとに個別のオフセット（マージン）値をOptions画面で設定可能
- カスタムサイズの追加・変更（編集）・削除機能（ウィンドウ基準時は補正オフセット指定可）。一覧はテンプレート直下に常時表示し、「カスタムサイズの設定」アコーディオンでは追加・変更フォームのみを扱う
- アイコンクリックで開くポップアップUI（ダークモード自動対応）
- 表示部分（Visible Tab）／ページ全体（Full Page、スクロール分割撮影＋結合）のスクリーンショット撮影
- `Captures` フォルダ（ダウンロード配下、名称変更可）へJPG形式で保存
- `@plasmohq/storage` によるローカル/同期ストレージの切り替え設定
- 設定・カスタムサイズ・プリセットオフセットを初期状態に戻すファクトリーリセット機能
- 多言語対応（日本語 / English）。Options画面の「言語」で「自動 / 日本語 / English」を選択可能（「自動」はブラウザのUI言語に従い、日本語以外は英語）

## バグ報告・フィードバック

不具合の報告や改善要望は、GitHubのIssuesページからお寄せください。

- [Issues](https://github.com/uc4696/window-resizer-screenshot/issues)

## 技術スタック / ディレクトリ構成

### 技術スタック

- [Plasmo](https://www.plasmo.com/) (Chrome Extension Framework)
- TypeScript / React
- `@plasmohq/storage`
- Chrome Extension Manifest V3

### ディレクトリ構成

Plasmoの「[src directory](https://docs.plasmo.com/framework/customization/src)」機能を使用しており、`tsconfig.json` で `~*` を `./src/*` にマッピングしています。これにより **Plasmoのエントリファイル（`popup.tsx` / `options.tsx` / `background.ts` 等）はすべて `src/` 配下に置く必要があります**（`assets/` はプロジェクトルートのまま）。

```
.
├── assets/
│   ├── _locales/{en,ja}/messages.json  # 拡張機能名・説明の多言語リソース
│   ├── icon-source.png             # 現行アイコンのデザイン原本（128x128）
│   ├── icon.png                    # Plasmoが要求するベースPNGアイコン（512x512）
│   ├── icon16.png / icon32.png / icon48.png / icon64.png / icon128.png  # サイズ別アイコン
│   ├── icon.svg                    # 旧仮アイコン（参考用）
│   └── buymeacoffee-button.png     # サポートリンク用の画像
├── scripts/
│   └── generate-icon.js            # icon-source.png から各サイズのアイコンを生成（sharp使用）
├── src/
│   ├── popup.tsx                   # ポップアップ本体（テンプレート選択・カスタムサイズ・スクショボタン）
│   ├── style.css                   # ポップアップ用スタイル（ダークモード対応）
│   ├── options.tsx                 # 設定画面（Optionsページ）本体
│   ├── options.css                 # 設定画面用スタイル（ダークモード対応）
│   ├── background.ts               # スクリーンショット撮影・ダウンロード処理（Service Worker）
│   ├── components/
│   │   ├── PresetGrid.tsx          # テンプレートサイズ選択ボタン群
│   │   ├── CustomSizeList.tsx      # カスタムサイズの一覧・適用・編集・削除UI
│   │   ├── CustomSizeManager.tsx   # カスタムサイズの追加・変更フォーム（アコーディオン）
│   │   └── SupportLink.tsx         # サポートリンク
│   └── lib/
│       ├── types.ts                # 型定義
│       ├── constants.ts            # デフォルトテンプレート・ストレージキー等の定数
│       ├── storage.ts              # local/sync切り替え可能な設定・データ管理
│       ├── offset.ts               # オフセット（補正値）の計算
│       ├── resize.ts               # ウィンドウ／ビューポートのリサイズ・バリデーション
│       ├── screenshot.ts           # Visible Tab / Full Page のスクリーンショット撮影
│       ├── filename.ts             # 保存ファイル名・保存パスの組み立て
│       ├── messages.ts             # popup <-> background 間のメッセージ型定義
│       └── i18n/                   # 多言語対応（messages.en.ts / messages.ja.ts / index.ts / useI18n.tsx）
├── package.json                    # 依存関係・manifest設定（permissions等）
├── tsconfig.json                   # TypeScript設定（~* -> ./src/* のエイリアス）
├── Cline_WORKFLOW.md               # アプリ固有の開発ルール
├── README.md / README.en.md        # ドキュメント（日本語 / English）
└── .prettierrc / .gitignore
```

### 多言語対応（i18n）の実装

- 翻訳辞書は `src/lib/i18n/messages.en.ts`（キーの基準）と `src/lib/i18n/messages.ja.ts`（同じキーを必須とする型付き）です。文言を追加する場合は両方に同じキーを追加してください（追加漏れは `npx tsc --noEmit` で検出されます）。
- コードからは `src/lib/i18n/index.ts` の `t(key, params?)` を使用します。`{name}` 形式のプレースホルダーを置換できます。React コンポーネントでは `useI18n()`（`src/lib/i18n/useI18n.tsx`）を使うと、言語切替時に再レンダリングされます。
- 言語設定（`auto` / `ja` / `en`）は `Settings.language` として `local` ストレージに保存されます（ファクトリーリセット対象）。
- 拡張機能の名前・説明（`chrome://extensions` やストア表示用）は `assets/_locales/{en,ja}/messages.json` で管理し、`package.json` の `__MSG_*__` と `default_locale`（`en`）で参照しています。これはブラウザの言語に従い、Options画面の言語設定とは独立しています。

## インストール・開発手順

1. Node.js（推奨: 最新LTS以降）がインストールされていることを確認してください。
2. 依存関係をインストールします（PowerShell）。

   ```powershell
   npm install
   ```

3. （Windows環境で npm 11 以降を使用している場合の注意）
   npm 11 以降は、`lmdb` / `@parcel/watcher` / `@swc/core` / `esbuild` / `msgpackr-extract` / `sharp` などのネイティブモジュールのインストールスクリプト（node-gyp rebuild等）をデフォルトでブロックします。これらがブロックされたままだと `plasmo build` 実行時に `ERROR | Bindings not found.` が発生します。
   `npm install` 実行後、以下を実行してネイティブバインディングを確実に生成してください。

   ```powershell
   npm rebuild
   ```

   （`npm install` を再実行した場合も同様にブロックされる場合があるため、そのたびに `npm rebuild` を実行してください。）

- 開発サーバーの起動（ホットリロード付き）:

  ```powershell
  npm run dev
  ```

  起動後、`build/chrome-mv3-dev` フォルダが生成されます。Chromeの `chrome://extensions` で「デベロッパーモード」を有効にし、「パッケージ化されていない拡張機能を読み込む」から `build/chrome-mv3-dev` を選択してください。

- 本番ビルド:

  ```powershell
  npm run build
  ```

  `build/chrome-mv3-prod` フォルダが生成されます。

- ストア用パッケージング（zip）の作成:

  ```powershell
  npm run package
  ```

  `build/chrome-mv3-prod.zip` が生成されます。ベータ版として配布する場合は、`window-resizer-screenshot-v0.1.1-beta.1.zip` のようにファイル名を変更してください（命名規則は `Cline_WORKFLOW.md` を参照）。

## リサイズ・スクリーンショットの仕様と制約事項

### 1. ウィンドウ基準リサイズと実測サイズ（OS差分・不可視ボーダー）
- **制約の背景**: Windows環境（DWM: Desktop Window Manager）では、ウィンドウの周囲にリサイズ操作用の「不可視の透明ボーダー（左右・下に各数px）」が付与されます。また、ディスプレイのスケーリング設定（100% / 125% / 150% 等）によってもピクセル計算に差異が生じます。
- **発生する現象**: `chrome.windows.update` API で例えば `1920x1080` を指定した場合でも、OS標準のスクショや外部キャプチャツールでウィンドウ外枠全体を計測した実測サイズが `1906x1073` など数ピクセル小さくなる（または大きくなる）現象が生じます。この差分サイズはChrome拡張機能のAPIからは検出できません。
- **対応方針**:
  - **テンプレート**: 環境への非依存性を保つため、オフセットなし（指定サイズそのまま）で適用されます。
  - **カスタムサイズ（オフセット機能）**: ご利用のOS・拡大率環境でウィンドウ外枠の実測スクショサイズを指定サイズに厳密に一致させたい場合、カスタムサイズの登録・編集時に「サイズ補正オフセット（幅補正・高さ補正 px）」を指定できます。例えば実測で幅が14px、高さが7px小さくなる環境では、オフセットに `+14` / `+7` を登録しておくことで、実測スクショサイズを目標サイズに合致させることができます。

### 2. ビューポート基準リサイズの制約（特殊ページでの動作不可）
- ビューポート（Webページ表示領域）の精密なサイズ測定と差分補正には、アクティブタブへのスクリプト実行（`chrome.scripting.executeScript`）が必要です。
- Chromeのセキュリティポリシーにより、`chrome://`（設定画面や拡張機能一覧など）、`chrome-extension://`、`edge://`、Chromeウェブストアなどの特殊ページではスクリプト注入がブロックされます。
- これらのページがアクティブな状態でビューポート基準のリサイズを実行すると、親切な案内エラーメッセージが表示され、サイズ変更は中断されます。通常のWebページ（`https://` や `http://`）を開いたタブで操作してください。

### 3. スクリーンショットの撮影対象範囲
- 本拡張機能のスクリーンショット機能（「表示部分を撮影」「ページ全体を撮影」）は、いずれも**タブ内のWebページコンテンツ（ビューポート領域）のみ**を対象としています。
- OSのタイトルバー、ブラウザのツールバー、ウィンドウの外枠を含む「ウィンドウ全体のスクリーンショット」はChrome拡張機能の標準キャプチャAPIでは取得できないため、外部キャプチャツール等をご利用ください。

### 4. 権限（Permissions）について

| 権限 | 用途 |
|---|---|
| `activeTab` | 拡張機能を操作したアクティブタブに対するスクリプト注入・スクリーンショット撮影 |
| `storage` | 設定・カスタムサイズの保存（local/sync） |
| `downloads` | スクリーンショットの `Captures` フォルダへの保存 |
| `scripting` | ビューポート実測、およびページ全体スクリーンショットのスクロール制御・計測スクリプト注入 |

`host_permissions`（`<all_urls>`）、`tabs`、`system.display` は使用していません。カスタムサイズ入力時の解像度の上限チェックには、ポップアップが表示されているディスプレイの `window.screen` の値を使用します。

## バージョン管理・変更履歴（Changelog）

`package.json` の `version` フィールドは、Plasmoの制約によりドット区切り3桁の整数（MAJOR.MINOR.PATCH）のみで管理しています（現在: `0.1.1`）。ベータ版であることは、配布用ZIPのファイル名・README・Gitタグで表記します（例: `window-resizer-screenshot-v0.1.1-beta.1.zip`）。

| バージョン | リリース日 | 内容 |
|---|---|---|
| 0.1.1（beta.1） | 2026-10-04 | 権限を最小化。`host_permissions`（`<all_urls>`）、`tabs`、`system.display` を削除し、`activeTab`・`scripting`・`storage`・`downloads` のみで動作するように変更。解像度の上限チェックは `window.screen` を参照するように変更 |
| 0.1.0（beta.1） | 2026-10-03 | 0.1.0 ベータ版の初回リリース。ウィンドウ／ビューポートのリサイズ（16:9・4:3の解像度テンプレート、テンプレートごとのオフセット設定、カスタムサイズの追加・編集・削除）、表示部分／ページ全体（スクロール分割撮影＋結合）のスクリーンショット撮影と `Captures` フォルダへのJPG保存、local/syncストレージの切り替え、ファクトリーリセット、多言語対応（日本語 / English）、ダークモード対応を搭載 |

---

## ライセンス・ソースコードの利用について

- 本リポジトリのソースコードは、技術ブログの解説・学習の参照用として公開しています。
- **商用利用は禁止**します。
- **再配布・転売は禁止**します。ソースコードをそのまま、あるいは一部改変して、Chromeウェブストア等に再配布・公開・販売することは固く禁止します。
- 個人利用の範囲内であれば、自由に利用していただけます。

