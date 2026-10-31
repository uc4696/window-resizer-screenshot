# プライバシーへの取り組み（ダッシュボード入力用）

ダッシュボードの「プライバシーへの取り組み」タブは言語別の入力欄がないため、英語の文面を貼り付ける。日本語は確認用の訳。

## 単一用途の説明（Single purpose）

```text
Resize the browser window or viewport to a specified size and capture screenshots of the current page (visible area, full page, or a selected scrollable area) at that size.
```

（訳）ブラウザのウィンドウ／ビューポートを指定サイズに変更し、そのサイズで現在のページのスクリーンショット（表示部分・ページ全体・選んだスクロール範囲）を撮影する。

## 権限の用途（Permission justification）

### activeTab

```text
Used only when the user clicks the toolbar icon, to work on the current tab: capture screenshots with chrome.tabs.captureVisibleTab, read and reset the tab's zoom level before resizing (chrome.tabs.getZoom / setZoom), and run scripts on that page. No other tabs are accessed.
```

（訳）ユーザーがツールバーアイコンを押したときだけ、現在のタブを対象に使う。スクリーンショット撮影、リサイズ前の拡大率の取得と 100% への戻し、そのページでのスクリプト実行。他のタブにはアクセスしない。

### scripting

```text
Injects scripts into the current tab (granted via activeTab) to: measure the viewport size for viewport-based resizing; scroll the page or an inner scrollable area and temporarily hide fixed/sticky elements for full-page screenshots, then restore them; detect scrollable areas on the page; and show an on-page selection UI that lets the user click a scrollable area to download or copy a screenshot of it. The scripts run only after a user action and do not collect or send any page content.
```

（訳）activeTab で許可された現在のタブにスクリプトを注入し、次を行う。ビューポート基準のリサイズのためのサイズ計測、ページ全体撮影のためのページ／内側のスクロール範囲のスクロールと fixed・sticky 要素の一時的な非表示（撮影後に元へ戻す）、ページ上のスクロール範囲の検出、スクロール範囲をクリックで選んでダウンロード／コピーするための選択 UI の表示。ユーザー操作の後にだけ実行し、ページの内容を収集・送信しない。

### storage

```text
Stores the user's settings locally (or in Chrome sync if the user chooses): custom sizes, preset offsets, save folder name, image format, language, the last selected size mode, and capture/zoom options. Nothing is sent to external servers.
```

（訳）ユーザーの設定（カスタムサイズ、プリセットのオフセット、保存先フォルダ名、画像形式、言語、最後に選んだサイズ基準、撮影・拡大率のオプション）をローカル（ユーザーが選べば Chrome の同期領域）に保存する。外部サーバーへは送信しない。

### downloads

```text
Saves the captured screenshot as an image file (PNG / WebP / JPEG) into the user's Downloads folder, in the subfolder name the user specified.
```

（訳）撮影したスクリーンショットを画像ファイル（PNG / WebP / JPEG）として、ユーザーが指定したサブフォルダ名でダウンロードフォルダに保存する。

## リモートコード

使用していない（「いいえ、リモートコードを使用していません」）。

## データの使用

収集するユーザーデータはなし。3 つの宣言（承認された用途以外で第三者に販売しない／中心機能と無関係な目的で使用・転送しない／信用力の判断や融資目的で使用・転送しない）にすべてチェック。
