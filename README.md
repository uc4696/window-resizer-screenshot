# Window & Viewport Resizer (Chrome拡張機能)

**日本語** | [English](README.en.md)

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

## 多言語対応（i18n）

- 翻訳辞書は `src/lib/i18n/messages.en.ts`（キーの基準）と `src/lib/i18n/messages.ja.ts`（同じキーを必須とする型付き）です。文言を追加する場合は両方に同じキーを追加してください（追加漏れは `npx tsc --noEmit` で検出されます）。
- コードからは `src/lib/i18n/index.ts` の `t(key, params?)` を使用します。`{name}` 形式のプレースホルダーを置換できます。React コンポーネントでは `useI18n()`（`src/lib/i18n/useI18n.tsx`）を使うと、言語切替時に再レンダリングされます。
- 言語設定（`auto` / `ja` / `en`）は `Settings.language` として `local` ストレージに保存されます（ファクトリーリセット対象）。
- 拡張機能の名前・説明（`chrome://extensions` やストア表示用）は `assets/_locales/{en,ja}/messages.json` で管理し、`package.json` の `__MSG_*__` と `default_locale`（`en`）で参照しています。これはブラウザの言語に従い、Options画面の言語設定とは独立しています。


## 技術スタック

- [Plasmo](https://www.plasmo.com/) (Chrome Extension Framework)
- TypeScript / React
- `@plasmohq/storage`
- Chrome Extension Manifest V3

## ディレクトリ構成（現状）

Plasmoの「[src directory](https://docs.plasmo.com/framework/customization/src)」機能を使用しており、`tsconfig.json` で `~*` を `./src/*` にマッピングしています。これにより **Plasmoのエントリファイル（`popup.tsx` / `options.tsx` / `background.ts` 等）はすべて `src/` 配下に置く必要があります**（`assets/` はプロジェクトルートのまま）。

```
.
├── assets/
│   ├── icon.svg                    # 旧仮アイコン（SVG、デザイン原本・参考用に残置）
│   ├── icon-source.png             # 現行アイコンのデザイン原本（128x128）
│   ├── icon.png                    # Plasmoが要求するベースPNGアイコン（icon-source.pngから生成、512x512）
│   ├── icon16.png / icon48.png / icon128.png  # 提供された各サイズのアイコン（Plasmoのサイズ別上書き）
│   └── icon32.png / icon64.png     # icon-source.pngから生成した中間サイズ（sharpを使用）
├── scripts/
│   └── generate-icon.js            # icon-source.png -> icon.png/icon32.png/icon64.png を生成するNode.jsスクリプト（sharpを使用）
├── src/
│   ├── popup.tsx                    # ポップアップ本体（テンプレート選択・カスタムサイズ・スクショボタン）
│   ├── style.css                    # ポップアップ用スタイル（ダークモード対応）
│   ├── options.tsx                  # 設定画面（Optionsページ）本体
│   ├── options.css                  # 設定画面用スタイル（ダークモード対応）
│   ├── background.ts                # スクリーンショット撮影・ダウンロード処理（Service Worker）
│   ├── components/
│   │   ├── PresetGrid.tsx           # テンプレートサイズ選択ボタン群
│   │   ├── CustomSizeList.tsx       # 保存済みカスタムサイズの一覧・適用・編集・削除UI（テンプレート直下に常時表示）
│   │   └── CustomSizeManager.tsx    # カスタムサイズの追加・変更フォーム（アコーディオン）
│   └── lib/
│       ├── types.ts                 # 型定義（SizeMode, SizePreset, CustomSize等）
│       ├── constants.ts             # デフォルトテンプレート・ストレージキー等の定数
│       ├── storage.ts                # @plasmohq/storage を用いたlocal/sync切り替え可能な設定・データ管理
│       ├── resize.ts                 # ウィンドウ／ビューポートのリサイズ・ディスプレイ基準バリデーション
│       ├── screenshot.ts             # Visible Tab / Full Page（chrome.debugger CDP）のスクリーンショット撮影
│       ├── filename.ts               # 保存ファイル名・保存パスの組み立て
│       └── messages.ts               # popup <-> background 間のメッセージ型定義
├── package.json                     # 依存関係・manifest設定（permissions等）
├── tsconfig.json                    # TypeScript設定（~* -> ./src/* のエイリアス設定含む）
├── .gitignore
├── .prettierrc
└── README.md
```

## インストール手順

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

## ビルド・開発手順

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

- 配布用パッケージ（zip）の作成:

  ```powershell
  npm run package
  ```

## 現在の実装状況（進捗）

### ステップ1: プロジェクト初期化（完了）

- `package.json` を手動作成し、以下を設定
  - 依存関係: `plasmo`, `react`, `react-dom`, `@plasmohq/storage`
  - 開発依存: `@types/chrome`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `prettier`, `svgo`
  - `manifest.permissions`: `tabs`, `activeTab`, `storage`, `downloads`, `scripting`, `debugger`
  - `manifest.host_permissions`: `<all_urls>`（フルページスクリーンショットや任意タブへのリサイズ操作に必要）
  - `manifest.action` はあえて指定しない（Plasmoが `popup.tsx` を自動検出して `action.default_popup` / `default_icon` を自動生成するため。手動で `action` を指定すると自動マージされず上書きされてしまうことを確認済み）
- `tsconfig.json`（Plasmo標準構成）を作成
- 最低限のReactボイラープレート `popup.tsx` / `style.css` を作成（現在のウィンドウサイズを表示するだけの仮実装）
- 仮アイコン `assets/icon.svg`（ウィンドウリサイズをイメージした矢印デザイン）を作成し、`scripts/generate-icon.js`（sharp使用）で `assets/icon.png`（512x512）を生成・配置
- `.gitignore` / `.prettierrc` を作成
- `npm install` を実行し依存関係を解決
- `npm run build` を実行し、`build/chrome-mv3-prod` に `manifest.json` / `popup.html` / `popup.*.js` / `popup.*.css` / アイコン一式が正しく生成されることを確認（動作確認済み）

### ステップ2〜6: 本体機能の実装（完了）

`package.json` の `version` を `0.2.0` に更新し、以下をまとめて実装しました。

- **Plasmoの `src` ディレクトリ構成へ移行**
  - `tsconfig.json` の `~*` -> `./src/*` エイリアスに合わせ、`popup.tsx` / `options.tsx` / `background.ts` などのエントリファイルをすべて `src/` 配下に移動（`assets/` はルートのまま）。移動前は `popup.tsx` がルート直下にあったため Plasmo がエントリファイルを認識できず、空の拡張機能になる不具合を確認・修正しました。

- **ステップ2: ポップアップUI（`src/popup.tsx`, `src/components/*`）**
  - 現在のウィンドウサイズ・ビューポートサイズをポップアップを開いた時点でリアルタイム表示
  - 「ウィンドウ基準」「ビューポート基準」の切り替えタブ
  - デフォルトテンプレート5種（スマホ縦/横・タブレット・PC標準・PC Full HD）を `PresetGrid` コンポーネントでボタン表示
  - `CustomSizeManager` コンポーネントでカスタムサイズの追加・削除・適用をポップアップ内でシームレスに実施
  - `prefers-color-scheme` によるダークモード自動対応（CSS変数切り替え）
  - フッターから「⚙ 設定を開く」で Options ページを新規タブで開く

- **ステップ3: ストレージロジック（`src/lib/storage.ts`）**
  - `@plasmohq/storage` を使用し、設定（Captureフォルダ名・storageArea選択）は常に `local` に保存
  - カスタムサイズ本体は設定で選択された `local`/`sync` の `Storage` インスタンスに保存・取得
  - Options画面で `storageArea` を切り替えた際は `migrateCustomSizes()` で既存データを新しい area にコピー

- **ステップ4: リサイズロジック（`src/lib/resize.ts`）**
  - `chrome.windows.update` によるウィンドウ全体サイズ変更
  - ビューポート基準リサイズは、現在のウィンドウ幅高さとビューポート幅高さの差分（ブラウザUI枠）を測定し、その差分を加算したウィンドウサイズに変更することで実現
  - `chrome.system.display.getInfo()` でアクティブウィンドウが乗っているディスプレイの解像度を取得し、カスタムサイズ入力時に「200px以上」「整数」「現在のディスプレイ解像度以下」をバリデーション

- **ステップ5: スクリーンショット撮影（`src/lib/screenshot.ts`, `src/background.ts`）**
  - 表示部分（Visible Tab）: `chrome.tabs.captureVisibleTab` でJPEG取得
  - ページ全体（Full Page）: `chrome.scripting.executeScript` でページサイズ・DPIを計測し、`innerHeight` 単位で最上部から最下部まで自動スクロールしながら `chrome.tabs.captureVisibleTab` で分割撮影、`OffscreenCanvas` 上に結合して1枚のJPEG画像を生成
    - `position: fixed` / `sticky` 要素は、スクロール後にJSが追従要素を切り替えるのを待ってから `opacity: 0` で一時的に非表示化し、追従ヘッダー等の多重写り込みを防止
    - 撮影範囲は撮影開始時のページ高さで固定し、タイル数上限（40枚）・キャンバス上限に達した場合はそこまでを1枚に出力（YouTube等の無限スクロール対策）
    - 撮影完了後はスクロール位置・スタイルを元の状態に復元
  - `chrome.downloads.download` で `Captures/screenshot_YYYYMMDD_HHMISS.jpg` 形式で保存（`conflictAction: "uniquify"` で重複時は自動リネーム）
  - popup とbackground（Service Worker）間は `chrome.runtime.sendMessage` / `onMessage` で通信

- **ステップ6: オプションページ（`src/options.tsx`）**
  - Captures フォルダ名を任意の文字列に変更可能
  - `storageArea`（local/sync）をラジオボタンで切り替え可能。切り替え時に既存カスタムサイズを自動移行
  - ダークモード対応

### 動作確認

- `npx tsc --noEmit` で型エラーなしを確認
- `npm run build` で `build/chrome-mv3-prod` に以下が正しく生成されることを確認
  - `manifest.json`（`action.default_popup`, `background.service_worker`, `options_ui.page` が自動設定されている）
  - `popup.html` / `popup.*.js` / `popup.*.css`
  - `options.html` / `options.*.js` / `options.*.css`
  - `static/background/index.js`（Service Worker）
  - アイコン一式

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

## 権限（Permissions）について

| 権限 | 用途 |
|---|---|
| `tabs` | 現在のタブ情報の取得、タブ操作 |
| `activeTab` | アクティブタブへのスクリプト注入 |
| `storage` | 設定・カスタムサイズの保存（local/sync） |
| `downloads` | スクリーンショットの `Captures` フォルダへの保存 |
| `scripting` | ビューポート実測、およびページ全体スクリーンショットのスクロール制御・計測スクリプト注入 |
| `system.display` | カスタムサイズ入力時の現在ディスプレイ解像度の取得（バリデーション基準） |
| `host_permissions: <all_urls>` | 任意のページでのスクリーンショット・リサイズ操作 |

## バージョン管理

`package.json` の `version` フィールドで管理しています（現在: `0.7.0`）。機能追加・修正時にはSemVerに従いバージョンをインクリメントします。

| バージョン | 内容 |
|---|---|
| 0.1.0 | ステップ1: プロジェクト初期化（`package.json`/`tsconfig.json`/最小ボイラープレート/仮アイコン/`npm install`・ビルド動作確認） |
| 0.2.0 | ステップ2〜6: ポップアップUI・ストレージ・リサイズロジック・スクリーンショット・オプションページの実装、`src`ディレクトリ構成への移行 |
| 0.3.0 | テンプレートをPC画面サイズ5種に統一、カスタムサイズの追加・変更（編集）・削除対応、ウィンドウ基準用オフセット補正オプション追加、特殊ページでのビューポートエラーハンドリング改善 |
| 0.4.0 | フルページキャプチャを「スクロール分割撮影＋結合」方式に変更し、可視領域が重複して繰り返し撮影される不具合を修正（`debugger`権限を削除）。解像度テンプレートを16:9（HD/FHD/WQHD/4K）・4:3（VGA/SVGA/XGA/UXGA）の8種に刷新し、テンプレートごとの個別オフセット設定機能を追加。Options画面にファクトリーリセット（設定の初期化）機能を追加 |
| 0.5.0 | カスタムサイズ一覧をテンプレート直下に常時表示するよう変更（`CustomSizeList`コンポーネントを新設し、アコーディオンは追加・変更フォーム専用に）。編集（✎）押下時はアコーディオンを自動的に開いてから編集状態にするよう修正。アコーディオンのラベルを「カスタムサイズの設定」に変更。フルページ撮影で、スクロール後に動的追従表示されるヘッダー等の多重写り込みと、ページ高さ変動による末尾の余白が残る不具合を修正（タイルごとの再走査・実DPR算出・末尾クロップに対応）。拡張機能アイコンを新デザインに刷新 |
| 0.7.0 | 多言語対応（日本語 / English）を追加。Options画面で言語（自動 / 日本語 / English）を選択可能に。既存UI文言・エラーメッセージを翻訳辞書（`src/lib/i18n`）へ移行し、拡張機能名・説明を `_locales` で多言語化 |
