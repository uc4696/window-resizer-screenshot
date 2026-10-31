import type { MessageKey } from "./messages.en"

/** 日本語メッセージ辞書。英語辞書と同じキーを必須とする（追加漏れは型エラーになる）。 */
export const ja: Record<MessageKey, string> = {
  // ---- popup ----
  windowLabel: "ウィンドウ:",
  viewportLabel: "ビューポート:",
  modeWindow: "ウィンドウ基準",
  modeViewport: "ビューポート基準",
  screenshotTitle: "スクリーンショット",
  captureVisibleLabel: "表示部分",
  captureFullPageLabel: "ページ全体",
  captureVisibleDownload: "表示部分のスクリーンショットをダウンロード",
  captureVisibleCopy: "表示部分のスクリーンショットをクリップボードにコピー",
  captureFullPageDownload: "ページ全体のスクリーンショットをダウンロード",
  captureFullPageCopy: "ページ全体のスクリーンショットをクリップボードにコピー",
  capturePick: "スクロールする範囲を選んで撮影",
  capturePickUnavailable: "このページには選べるスクロール範囲がありません",
  pickerBanner: "撮影する範囲をクリック（Esc でキャンセル）",
  pickerContent: "内容 {height}px",
  pickerSave: "ダウンロード",
  pickerCopy: "コピー",
  pickerCancel: "キャンセル",
  statusCopied: "クリップボードにコピーしました。",
  errClipboard: "クリップボードへのコピーに失敗しました。",
  openSettings: "設定を開く",
  shareOnX: "Xで共有",
  shareOnXTitle: "この拡張機能をXで共有する（投稿画面が開きます）",
  shareText:
    "「このサイズだとどう見える？」をすぐ確認。\nウィンドウ/ビューポートのリサイズもページ全体スクショもこれ1つ📸",
  shareHashtags: "#Chrome拡張機能 #Web制作",
  statusResized: "サイズを {width} x {height} に変更しました。",
  statusError: "エラー: {message}",
  zoomConfirmMessage:
    "このページは {zoom}% に拡大縮小されています。意図したサイズにならないため、拡大率を 100% に戻してからリサイズします。",
  zoomConfirmOk: "100% に戻してリサイズ",
  statusCapturingFullPage: "ページ全体を撮影中...",
  statusCapturing: "撮影中...",
  errCaptureFailed: "撮影に失敗しました。",

  // ---- preset groups / badges ----
  presetGroup169: "16:9（ワイド）",
  presetGroup43: "4:3（スクエア）",
  offsetBadge: "Offset",

  // ---- custom size list ----
  customSizes: "カスタムサイズ",
  offsetTooltip: "(オフセット: {w} / {h}px)",
  offsetBadgeTitle: "適用時の補正値",
  edit: "編集",
  delete: "削除",

  // ---- custom size manager ----
  customToggleClose: "▲ カスタムサイズの設定を閉じる",
  customToggleOpen: "▼ カスタムサイズの設定",
  formTitleEdit: "カスタムサイズの変更",
  formTitleAdd: "カスタムサイズの追加",
  namePlaceholder: "名前（省略可）",
  widthPlaceholder: "幅",
  heightPlaceholder: "高さ",
  offsetLabel: "サイズ補正オフセット（任意・px）:",
  offsetWidthPlaceholder: "幅補正 (例: 14)",
  offsetHeightPlaceholder: "高さ補正 (例: 7)",
  offsetHint: "OSやDPIで見えない境界分ズレる場合に加算する補正値",
  displayHint: "現在のディスプレイ: {width} x {height}（この範囲内で指定）",
  update: "更新",
  add: "追加",
  cancel: "キャンセル",

  // ---- support link ----
  supportText: "ドリンクを奢って開発を応援する",

  // ---- options ----
  loading: "読み込み中...",
  optionsTitle: "Window & Viewport Resizer - 設定",
  languageLabel: "言語",
  languageHint:
    "表示言語を選択します。「自動」はブラウザの言語に従います（非対応の言語は英語になります）。",
  languageAuto: "自動",
  captureDirLabel: "スクリーンショット保存先フォルダ名",
  captureDirHint:
    "ダウンロードフォルダ配下に作成されるフォルダ名です（例: Downloads/Captures/...）。",
  imageFormatLabel: "スクリーンショットの既定形式",
  imageFormatHint:
    "ダウンロード保存時の形式です。クリップボードへのコピーは常にPNG形式になります。",
  scrollAreaFrameLabel: "スクロール範囲の撮影",
  scrollAreaFrameHint:
    "内側の範囲だけがスクロールするページでは、ページ全体の撮影はその範囲だけを撮ります。有効にすると、最初の1画面の外枠（ヘッダー・サイドバー等）を残し、範囲の下にある部分を最後に付け足します。サイドバー等は伸びないため、最初の1画面分だけが写ります。",
  scrollAreaFrameCheckbox: "外枠と範囲の下の部分も含める",
  zoomResetLabel: "拡大縮小されたページのリサイズ",
  zoomResetHint:
    "ページの拡大率が 100% 以外のときは、意図したサイズになるよう拡大率を 100% に戻してからリサイズします。",
  zoomResetConfirmCheckbox: "拡大率を戻す前に確認メッセージを表示する",
  storageLabel: "ストレージ領域（カスタムサイズの保存先）",
  storageHint:
    "local: この端末のみに保存されます。sync: Googleアカウントに紐づき、他端末とも同期されます。",
  storageLocalDefault: "local（既定）",
  save: "保存",
  settingsSaved: "設定を保存しました。",
  presetOffsetLabel: "解像度テンプレートのオフセット（マージン）",
  presetOffsetHint:
    "各プリセットに、ウィンドウ基準／ビューポート基準それぞれ個別の補正値（px）を設定できます。空欄のまま保存するとそのモードは補正なしになります。",
  offsetWidthShort: "幅補正",
  offsetHeightShort: "高さ補正",
  clear: "クリア",
  resetLabel: "ファクトリーリセット（設定の初期化）",
  resetHint:
    "保存先フォルダ名・スクリーンショット形式・スクロール範囲の撮影設定・ストレージ領域・言語・カスタムサイズ・プリセットのオフセットをすべて初期状態に戻します。",
  resetButton: "設定を初期化する",
  resetDone: "設定を初期化しました。",
  resetConfirm:
    "設定・カスタムサイズ・プリセットのオフセットをすべて初期状態にリセットします。この操作は取り消せません。よろしいですか？",

  // ---- validation / errors ----
  errInvalidInput: "入力値が不正です。",
  errInvalidOffset: "オフセット値が不正です。",
  errSizeNumeric: "幅と高さには数値を入力してください。",
  errSizeInteger: "幅と高さは整数で入力してください。",
  errSizeMin: "幅・高さは {min}px 以上で指定してください。",
  errSizeMax:
    "幅・高さは現在のディスプレイ解像度 ({width}x{height}) 以下で指定してください。",
  errOffsetNumeric: "オフセット値には数値を入力してください。",
  errOffsetInteger: "オフセット値は整数で入力してください。",
  errOffsetRange: "オフセット値は -500px 〜 500px の範囲で指定してください。",
  errWindowInfo: "現在のウィンドウ情報を取得できませんでした。",
  errNoActiveTab: "アクティブなタブが見つかりませんでした。",
  errRestrictedPage:
    "Chromeの仕様上、特殊ページ（chrome:// など）ではビューポートサイズを取得できません。通常のWebページを開いた状態で実行してください。",
  errViewportFailed: "ビューポートサイズの取得に失敗しました: {message}",
  errViewportUnavailable: "ビューポートサイズを取得できませんでした。",
  errPageSize: "ページサイズの取得に失敗しました。",
  errPageTooLarge:
    "ページが大きすぎるため、ページ全体のスクリーンショットを生成できませんでした（{width}x{height}）。",
  errCanvas: "キャンバスコンテキストの作成に失敗しました。",
  errPickedAreaMissing: "選んだ範囲が見つかりませんでした。もう一度選んでください。"
}
