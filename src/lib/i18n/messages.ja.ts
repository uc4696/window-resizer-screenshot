import type { MessageKey } from "./messages.en"

/** 日本語メッセージ辞書。英語辞書と同じキーを必須とする（追加漏れは型エラーになる）。 */
export const ja: Record<MessageKey, string> = {
  // ---- popup ----
  currentWindowSize: "今のウィンドウのサイズ",
  currentViewportSize: "今のビューポートのサイズ（ページが表示される部分）",
  modeWindow: "ウィンドウ基準",
  modeViewport: "ビューポート基準",
  modeWindowShort: "ウィンドウ",
  modeViewportShort: "ビューポート",
  modeWindowTitle: "ツールバーなどを含むウィンドウ全体を、選んだサイズにします",
  modeViewportTitle: "ページが表示される部分を、選んだサイズにします",
  screenshotTitle: "スクリーンショット",
  captureVisibleLabel: "表示部分",
  captureFullPageLabel: "ページ全体",
  captureVisibleDownload: "表示部分のスクリーンショットをダウンロード",
  captureVisibleCopy: "表示部分のスクリーンショットをクリップボードにコピー",
  captureFullPageDownload: "ページ全体のスクリーンショットをダウンロード",
  captureFullPageCopy: "ページ全体のスクリーンショットをクリップボードにコピー",
  captureDelayTitle: "タイマー",
  captureDelayLabel:
    "タイマー: ダウンロードを押してから数秒後に撮影します。その間にメニューなどを開けます",
  captureDelayNone: "なし",
  captureDelaySeconds: "{seconds}秒",
  captureNoCopyWithDelay:
    "タイマーではコピーとスクロール付きの部分の選択を使えません。待つ間に popup が閉じるので、保存だけになります。",
  capturePick: "一覧など、枠の中だけスクロールする部分を選んで、全体を撮影します",
  capturePickUnavailable: "このページには、枠の中だけスクロールする部分がありません",
  pickerBanner: "撮影するスクロール付きの部分をクリック（Esc でキャンセル）",
  pickerContent: "内容 {height}px",
  pickerSave: "ダウンロード",
  pickerCopy: "コピー",
  pickerCancel: "キャンセル",
  statusCopied: "クリップボードにコピーしました。",
  errClipboard: "クリップボードへのコピーに失敗しました。",
  openSettings: "設定を開く（言語、テーマ、保存先など）",
  shareOnTitle: "この拡張機能を{name}で共有する（投稿画面が開きます）",
  shareText:
    "「このサイズだとどう見える？」をすぐ確認。\nウィンドウ/ビューポートのリサイズもページ全体スクショもこれ1つ📸",
  shareHashtags: "#Chrome拡張機能 #Web制作",
  statusResized: "サイズを {width} x {height} に変更しました。",
  statusError: "エラー: {message}",
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
  customToggleClose: "フォームを閉じる",
  customToggleOpen: "カスタムサイズを追加",
  customDefaultName: "カスタム {n}",
  useCurrentSize: "今のサイズを入れる",
  formTitleEdit: "カスタムサイズの変更",
  formTitleAdd: "カスタムサイズの追加",
  namePlaceholder: "名前（省略可）",
  widthPlaceholder: "幅",
  heightPlaceholder: "高さ",
  offsetLabel: "サイズ補正オフセット（任意・px）:",
  offsetWidthPlaceholder: "幅補正",
  offsetHeightPlaceholder: "高さ補正",
  offsetHint: "OS や DPI によるズレを補正します",
  displayHint: "ディスプレイ: {width} x {height}（これが上限）",
  update: "更新",
  add: "追加",
  cancel: "キャンセル",

  // ---- review prompt ----
  reviewPromptTitle: "Window & Viewport Resizer は役に立っていますか？",
  reviewPromptBody: "Chrome ウェブストアで評価する。",
  reviewPromptSupport: "ドリンク1杯ごちそうする！",
  reviewPromptRate: "ストアで評価する",
  reviewPromptLater: "あとで",
  reviewPromptNever: "表示しない",

  // ---- support link ----
  supportText: "ドリンクを奢って開発を応援する",

  // ---- options ----
  loading: "読み込み中...",
  optionsTitle: "Window & Viewport Resizer - 設定",
  languageLabel: "言語",
  languageHint:
    "表示言語を選択します。「自動」はブラウザの言語に従います（非対応の言語は英語になります）。",
  languageAuto: "自動",
  themeLabel: "テーマ",
  themeHint: "ポップアップとこの画面の色を選びます。",
  themeAuto: "ブラウザに合わせる",
  themeLight: "ライト",
  themeDark: "ダーク",
  captureDirLabel: "スクリーンショット保存先フォルダ名",
  captureDirHint:
    "ダウンロードフォルダ配下に作成されるフォルダ名です（例: Downloads/Captures/...）。",
  imageFormatLabel: "スクリーンショットの既定形式",
  imageFormatHint:
    "ダウンロード保存時の形式です。クリップボードへのコピーは常にPNG形式になります。",
  scrollAreaFrameLabel: "スクロール付きの部分の撮影",
  scrollAreaFrameHint:
    "内側だけがスクロールするページでは、ページ全体の撮影はスクロール付きの部分だけを撮ります。有効にすると、最初の1画面の外枠（ヘッダー・サイドバー等）を残し、その下にある部分を最後に付け足します。サイドバー等は伸びないため、最初の1画面分だけが写ります。",
  scrollAreaFrameCheckbox: "外枠とその下の部分も含める",
  keepOnScreenLabel: "ウィンドウを画面内に収める",
  keepOnScreenHint:
    "リサイズで画面からはみ出すときは、サイズはそのままで、はみ出す分だけ位置をずらします。画面より大きいサイズは、ツールバーのアイコンに触れるよう右上に合わせます。複数のモニターにまたがって使うときはオフにしてください。",
  keepOnScreenCheckbox: "はみ出すときはウィンドウの位置をずらす",
  shortcutsLabel: "キーボードショートカット",
  shortcutsHint:
    "既定では何も割り当てていません。使うものだけ、Chrome のショートカットの画面で割り当ててください。プリセットは popup で最後に選んだ基準（ウィンドウ／ビューポート）で、カスタムサイズはそのサイズの基準でリサイズします。結果はツールバーのアイコンに出ます。コピーは https のページと localhost だけで動きます。chrome:// などの特殊なページで使えるのは、表示部分のダウンロードだけです。",
  shortcutsOpen: "Chrome のショートカットの画面を開く",
  shortcutsNotSet: "未設定",
  shortcutsSlotHint:
    "各枠で使うカスタムサイズを選びます。空の枠のショートカットは何もしません。",
  shortcutsSlotEmpty: "（空き）",
  storageLabel: "ストレージ領域（カスタムサイズの保存先）",
  storageHint:
    "local: この端末のみに保存されます。sync: Googleアカウントに紐づき、他端末とも同期されます。",
  storageLocalDefault: "local（既定）",
  settingsSaved: "設定を保存しました。",
  presetOffsetLabel: "解像度テンプレートのオフセット（マージン）",
  presetOffsetHint:
    "各プリセットに、ウィンドウ基準／ビューポート基準それぞれ個別の補正値（px）を設定できます。両方を空欄にすると、そのモードは補正なしになります。",
  offsetWidthShort: "幅補正",
  offsetHeightShort: "高さ補正",
  resetLabel: "ファクトリーリセット（設定の初期化）",
  resetHint:
    "保存先フォルダ名・スクリーンショット形式・スクロール付きの部分の撮影設定・ストレージ領域・言語・カスタムサイズ・プリセットのオフセットをすべて初期状態に戻します。",
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
  errViewportUnavailable: "ビューポートサイズを取得できませんでした。",
  errPageSize: "ページサイズの取得に失敗しました。",
  errPageTooLarge:
    "ページが大きすぎるため、ページ全体のスクリーンショットを生成できませんでした（{width}x{height}）。",
  errCanvas: "キャンバスコンテキストの作成に失敗しました。",
  errShortcutSlotEmpty:
    "カスタムサイズ {slot} にサイズが割り当てられていません。拡張機能の設定で選んでください。",
  errShortcutPresetUnknown: "このショートカットのプリセットが見つかりません。",
  errClipboardUnavailable:
    "このページではコピーできません（https か localhost のページのみ）。",
  errBoundsRejected:
    "この画面では {width} x {height} のウィンドウにできません（Chrome は、ウィンドウの半分以上が画面内にあることを求めます）。",
  errDelayTabChanged: "タイマーの間にタブが切り替わったので撮影しませんでした。",
  sizeOverDisplay: "このディスプレイ（{width} x {height}）より大きいサイズです",
  viewportOverDisplay:
    "ブラウザの枠を含めると、このディスプレイ（{width} x {height}）より大きくなります",
  errPickedAreaMissing: "選んだ部分が見つかりませんでした。もう一度選んでください。"
}
