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
- 単体テスト: `npm test`（`tests/unit/*.test.mjs`。node の型除去で `src/` の `.ts` を直接読むので、対象のファイルは `~lib` などの別名を import しない）。
- E2E はふだん `npm run test:e2e:wsl` で実行する（`scripts/e2e-wsl.sh`）。WSL2 の Ubuntu と xvfb で動くので、Windows の画面にブラウザが出ず、クリップボードも変わらない。作業中のファイルを `~/e2e/resizer` に rsync で同期し、ビルドと Chrome の取得も WSL 側で行い、`test-results/` を Windows 側に戻す。引数は Playwright に渡る（`-- tests/e2e/<name>.spec.ts`）。Beta は `-- --channel beta`、Chrome の更新は `-- --update-browser`。WSL には Node 24（nvm）・xvfb・xauth・rsync・unzip が要る。
- Windows の `npm run test:e2e` は、リリース前の確認と、Windows でだけ起きる問題を疑うときに使う。`build/chrome-mv3-prod` を読み込むので先に `npm run build` が必要。ブラウザは `npm run test:install-browser`（`.chrome-for-testing/` に取得、Beta は `CHROME_CHANNEL=beta`）。実ウィンドウを操作するため直列実行で、実行中はブラウザが画面の前面に開いて作業を止める。
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
- **拡大中のページ全体の撮影**: 画像の幅は描画エリアの幅で、横にはみ出す部分は撮らない（左端が基準。人の判断で、横スクロールの位置は見ない）。ページの縦スクロールバーはタイルごとに右端に写ってつながるが、切り落とすと画像が指定の幅より狭くなるので、そのままにする（人の判断で許容）。つなぎ位置の倍率は、丸められた `innerWidth` ではなく小数まで測った幅で求める（`exactViewportWidth`。丸めると 1.5006 倍になり、下へ行くほどズレてすき間に背景色の線が出ていた）。送り幅は `visualViewport.height` の切り捨て（`innerHeight` は切り上がることがあり、横スクロールバーの分も含むため）。拡大率とスケールの 36 通りですき間なしを確認。つないだ画像は最後に描画エリアのサイズへ縮小する（下の「ビューポートと画像のサイズ」）。
- **範囲を選んで撮影**: 「ページ全体」の行の［選択］（click アイコン）は、幅120px・高さ80px以上で画面内に見えているスクロール要素があるときだけ押せる（popup 表示時に `countPickCandidates` で数える）。ツールチップは平易な文にしている。日本語の呼び方は、文言・ストア・LP とも「スクロール付きの部分」に揃える（人の判断。「範囲」は意味が伝わりにくく、「スクロールブロック」はスクロールを止める意味に読まれるため）。押すとページに選択 UI（Shadow DOM、`src/lib/picker.ts` の `scrollAreaPicker` を `executeScript` で注入、自己完結させる）を出して popup を閉じる。候補を破線枠で示し、カーソル下のいちばん内側の候補を強調、クリックでその位置に［ダウンロード］［コピー］［キャンセル］を出す。表示部分の行には［選択］と同じ幅の空き（`.icon-button-spacer`）を置き、ダウンロード／コピーを上下で揃える。選択中はページ側のクリック等を止める。Esc でいつでも中止。押されたら UI を消して要素に目印を付け、`mode: "picked"` で background に依頼する（撮り方は自動判定と同じ area / framed）。コピーはページ側で `ClipboardItem` に Promise を渡し、結果は `capture-badge` メッセージでバッジに出す。http のページ等クリップボード API が使えないときはコピーを出さない。background は拡張機能のページ以外から来た依頼では送信元タブを対象にする。
- **保存形式**: PNG（既定）/ WebP / JPEG を設定画面で選択（選択した時点で保存）。タイル撮影は常に PNG で行い、最終出力時だけ形式を変換する（`src/lib/screenshot.ts`）。`Settings.imageFormat` の不正値は `png` に正規化する。
- **保存（ダウンロード）**: 押下すると background が受け付けた時点で応答し、popup はすぐ閉じる。撮影・保存は background で続行し、結果は対象タブのツールバーアイコンのバッジで知らせる（撮影中 `...`・成功 `OK`・失敗 `!`、結果は3秒で消える。`src/background.ts`）。受け付け自体に失敗したときだけ popup を閉じずにエラーを表示する。
- **クリップボード**: 保存形式によらず常に PNG。`clipboardWrite` 権限は使わず、popup 側で `ClipboardItem` に Promise を渡す（`src/components/CaptureSection.tsx`）。そのためコピー完了までは popup を閉じない。成功時は check アイコンを出し、0.8秒後に popup を閉じる。失敗時は閉じずにエラーを表示する。
- **キーボードショートカット**: manifest の `commands`（`package.json`）に21個。`suggested_key` は付けない（既定では何も割り当てない。他の拡張・Windows・Chrome と必ず被るため）。名前と中身の対応は `src/lib/commands.ts`、処理は `src/background.ts` の `handleCommand`。プリセットは `size-mode` の基準、カスタムサイズは5枠（`CUSTOM_SLOT_COUNT`）で、設定 `customSizeSlots`（枠ごとのカスタムサイズ id）で割り当て、そのサイズ自身の基準を使う。一覧の順番で決めないのは、削除で別のサイズにずれないようにするため。空き枠・消えたサイズは `!` とツールチップで知らせる。結果はバッジ、理由は `chrome.action.setTitle`（空文字だと空になるので既定の文言を入れ直す）。コピーは popup がないので、ページに `copyCaptureInPage`（`src/lib/page-copy.ts`）を注入して書く（キー操作でページにユーザー操作が付くことを実キーで確認、`clipboardWrite` 不要）。拡大率の確認は `window.confirm` をページに出す。実キーの activeTab は xvfb + xdotool で確認済み（host 権限なしの複製）。E2E はキーを送れないので、テスト用の複製で控えた onCommand のリスナーを呼ぶ（`tests/e2e/fixtures.ts`）。
- **はみ出し防止**: `chrome.windows.update` は面積の50%以上が画面外だと拒否するので（`Bounds must be at least 50% within visible screen space`、xvfb で確認）、以前はウィンドウが右下にあると大きいサイズがエラーで止まっていた。設定 `keepWindowOnScreen`（既定 true）が有効なら、`left`/`top` を `placeWindow`（`src/lib/placement.ts`）で求めて一緒に渡す。サイズは変えない。作業領域は `screen.avail*`（popup は自分の screen、service worker はタブに注入、注入できなければ動かさない）。ディスプレイより大きいサイズは選べない（`exceedsDisplay`。幅か高さの片方でも超えたら、プリセット・カスタムサイズは押せず、ショートカットは `!`。オフセットは比較に含めない。`chrome://` ではショートカットは判定できずそのまま進める）。比べるのはスケール後の `screen` のサイズで、ビューポート基準はウィンドウの枠（`getWindowFrame`、ウィンドウとタブのサイズの差）を足して比べ、理由は `viewportOverDisplay`。ウィンドウの大きさの上限は全モニターを合わせた仮想画面で、モニターが 1 枚なら画面 + 約 20px で頭打ちになる（Windows の実機で確認。175% の 1024x768 は高さ 746 で止まっていた）。隣のモニターが背の高いときは作れるサイズも押せなくなるが、下端が画面の外に出るのでそれでよい。最大化中のウィンドウ基準は、入力と強調にディスプレイのサイズを使う（`resolveCurrentSize`）。動かすと拒否されるときは動かさずに再試行し（右隣にまたがると通る場合）、それでも拒否されたら `errBoundsRejected`。`system.display` は使わない。隣のモニターは分からないので、またがって使う人は設定でオフにする。`placeWindow` は単体テスト、実ウィンドウは `tests/e2e/keep-on-screen.spec.ts`。
- **遅延撮影タイマー**: 3・5・10秒（`DELAY_SECONDS`）。popup はスクリーンショット欄の見出しの行の `.capture-delay` で選び、保存を押すと popup を閉じて background が待つ（`CaptureRequest.delaySeconds`、`countDown`）。残り秒数はバッジ。service worker は30秒未満なら止まらないので `setTimeout` で待ち、alarms 権限は使わない。activeTab は同じページにいる間は有効で、10秒後の撮影が通ることを実キーで確認済み。コピーと範囲選択はタイマー中は押せない（popup が閉じるとユーザー操作がなくなる）。待つ間に別のタブへ移ると撮らずに `!`（`errDelayTabChanged`）。同じタブでまた始めると前のカウントダウンをやめる。選択はスイッチ式の `.delay-option` で、`capture-delay`（local）に保存し、なしに戻すまで続く（ファクトリーリセットで削除）。ショートカットは `capture-visible-delay-{3,5,10}`（表示部分の保存だけ）。古いバッジの消去の予定が新しいバッジを消さないよう、`badgeClearTimers` で取り消す。
- **SNS 共有**: `SHARE_TARGETS`（`src/lib/share.ts`）の 7 つ（X、Facebook、LINE、Threads、Bluesky、LinkedIn、Reddit）。投稿画面を新規タブで開くだけで権限は不要。本文は i18n（ja: `#Chrome拡張機能 #Web制作` / en: `#ChromeExtension #WebDev`）。Facebook と LinkedIn は URL だけ、LINE は URL と本文、Reddit は URL と名前。Bluesky は本文 300 文字までで、単体テストで確かめる。Instagram、TikTok、YouTube は Web の共有画面がないので置かない。
- **アイコン**: Tabler Icons（MIT）の `icons/*.svg` を `data-text:` でインライン展開する（`src/components/Icon.tsx`）。
  - Plasmo のビルドで SVG の `viewBox` が除去され、width/height を変えても縮小されず見切れる。そのため Icon.tsx で `viewBox="0 0 24 24"` を補い、width/height を `size` に書き換える。SVG 内の class（`icon ...`）は読み込み時に除去し、ラッパーのクラスは `.ui-icon`。
  - 線画（outline）: screenshot / viewport-tall / download / copy / check / settings / click / star / clock / app-window / viewport-wide / adjustments-horizontal / camera / plus / x。`ratio-16-9` / `ratio-4-3` は Tabler にないので自作（同じ線の太さ）。brand-x / brand-facebook / brand-linkedin は塗りつぶし（filled）で、ほかの SNS は Tabler に filled がないので線画。
  - サイズは既定 16px、フッターボタン内は 12px。
  - ライセンスは `licenses/LICENSE-tabler.txt`。設定画面に「Icons: Tabler Icons (MIT License)」と表記する。
- **サイズ基準の記憶**: 最後に選んだサイズ基準（window / viewport）を local ストレージのキー `size-mode` に保存し、ポップアップ表示時に復元する（`src/lib/storage.ts` の `getSizeMode` / `setSizeMode`、`src/popup.tsx` の `changeMode`）。不正値・未設定は window に正規化し、ファクトリーリセットで削除する。
- **popup のレイアウト**: 上から、今のサイズ（`.current-size-section`。見るだけなのでアプリカラーの薄い地 `--accent-soft` で枠線なし、1行）、基準の切り替え（アイコンと短い文字。説明はツールチップ）、プリセット（`PresetScreen` の SVG。どれも同じ大きさの面に短い名前。16:9 は 720p / 768p / 900p / 1080p で、利用者が最も多い 1080p のモニターに入るものを選んでいる。4:3 は VGA / SVGA / XGA / UXGA。詳しい表記はツールチップ、4列）、カスタムサイズ（見出しの右の ＋ でフォームを開閉、行は名前とサイズでオフセットはツールチップ。名前は未使用の番号の既定値を最初から入れる。［今のサイズを入れる］は今の基準の実サイズ）、撮影、寄付、フッター。今の基準のサイズと同じプリセットとカスタムサイズは濃い紫で強調（`is-current`）。読み取れないサイズは `—×—`。フッターは寄付の下で、左の `.footer-links` に SNS、右に設定。どちらもアイコンだけで、説明はツールチップ。アプリカラーは `--accent-color` の紫。見た目はフラットで、角は 0（`*` で指定）、押せるものは縁なしで薄い地（`--accent-soft`）、ホバーで少し濃くする（`--accent-soft-hover`）。その文字とアイコンは `--accent-on-soft`（ダークは読みやすいよう明るい #b4bdfd）。文字は `text-rendering: geometricPrecision` と Windows 向けのフォントの順で滑らかにする。ラベルの下は詰め、グループの間は空けて区切りを見せる。プリセットの文字は標準の太さ。タイマーはすき間なしでつなげ、両端の外側だけ丸める（`.delay-option`、ここだけ角丸）。リサイズの成功はメッセージを見せない（`.is-quiet` で読み上げ用にだけ残す）。エラーと撮影中は見せ、空のときは場所を取らない。撮影の行は 表示部分・ページ全体・タイマー の順。寄付の下にボーダー。
- **テーマ**: 設定 `theme`（auto / light / dark、既定 auto、不正値は auto）。`src/lib/theme.ts` が `<html data-theme>` を切り替える（auto は属性なしで prefers-color-scheme に従う）。読み込み時のちらつきを防ぐため localStorage に控えを持つ。色は `style.css` と `options.css` の変数で、ダークの値は media と `[data-theme="dark"]` の両方に書く。
- **設定画面の保存**: 保存ボタンはなく、変更した時点で保存する。テキストは入力ごと、オフセットは入力欄を離れたとき。保存できたことは `.options-saved-toast` を2秒出す。両方空のオフセットは削除。
- **ビューポートと画像のサイズ**: 「ビューポート基準で指定したサイズ＝画像のサイズ」を守る（人の判断）。サイズは `tabs.Tab.width/height` から読む（権限なし、拡大率に左右されない、`chrome://` でも読める。切り捨てなので 642.4 は 642）。前面にないタブのサイズは更新されない。端数の表示スケールではウィンドウの位置でサイズが変わるので（125% の `width: 640` が left 20 なら 640、left 21 なら 642。左端の切り捨てと右端の切り上げを往復している）、`resizeViewport`（`src/lib/resize.ts`）は Windows と Linux で left / top を周期の倍数に切り下げ（`positionStep`・`alignPosition`。125%・175% は 4、150% は 2、周期が 8 を超えるスケールと整数は揃えない）、幅と高さを別々に `指定 - タブのサイズ` で直す（`fitViewport`、100ms 待って読む、5 回まで）。届かない数は同じ指定に戻った時点で、指定以上で最小を残す（`nextWindowSize`。誤差は必ず＋側。125% の 643 は 642 と 644 にしかならないので 644）。macOS は整数のスケール、ChromeOS は未測定なので 1 回だけ変更する（`getPlatformInfo`）。スケールは popup なら自分の `devicePixelRatio`、ショートカットはタブに注入して拡大率で割り、読めなければ揃えない。指定のサイズは `chrome.storage.session` に持ち（ウィンドウごと、ウィンドウ基準のリサイズで消す。popup が途中で閉じてもよいよう直す前に記録する）、実サイズとの差が 0〜2 なら popup の表示と画像を指定のサイズに揃える（`snapToRequested`）。2 なのは位置を揃えられない環境があるため。手で 3px 以上変えたら揃えない。画像は `captureVisibleTab` が実ピクセルで返すので、描画エリアのサイズへ縮小し（高精細な画面では精細さが落ちる。「高精細で保存」は必要になったら足す）、はみ出す右と下は落とす（`drawScaled`）。ページ全体は `fitToDrawingArea` で幅を指定のサイズ、高さは同じ倍率。倍率は `拡大率 / devicePixelRatio`（`getDrawingAreaScale`）で、タブのサイズとの比は切り捨てで高さが 2〜3px 足りなくなるので、値が画像と合わないとき（DevTools のデバイス表示など）だけ使う。1 画面に収まるページは高さも指定に揃える。実機で確認した範囲：Windows の実設定 125・150・175%、2 枚目が 125%。ウィンドウのサイズは `--force-device-scale-factor` で再現できる（E2E の `displayScale`）が、`screen.width` は二重に割られ（125% で 1638）、最大化中のサイズも違う。xvfb は枠の大きさが違い、150% で高さ 720 に届かない。
- **拡大縮小されたページのリサイズ**: 拡大率は変えない（人の判断）。拡大率はウィンドウ・タブのサイズ・撮影の実ピクセルを変えないので、100% に戻す必要はない（スケール 4 通り × 拡大率 4 通りで同じことを確認。100% に戻す処理と確認の設定は削除した）。今のサイズの強調と入力もタブのサイズを使う。
- **評価のお願い**: Szna と同じ仕組み（`src/lib/review-prompt.ts`、`src/components/ReviewPrompt.tsx`）。インストールから3日（`REVIEW_PROMPT_MIN_DAYS`）たったあと、リサイズか撮影に成功したときに「出す」印（`pending`）を付け、次に popup を開いたときに、タイトルの下に大きく（高さ 400px 以上）出して本来の中身を下へ押し出す。その場では出さない。印を付けるのは、リサイズが popup の `applySize`、撮影が background の `handleCapture`（範囲選択も含む）。内容は見出し、［ストアで評価する］（星アイコン。`STORE_REVIEW_URL` を新規タブで開く）、Buy Me a Coffee のバナー（同じ 200×56px）、［あとで］［表示しない］。［あとで］はそこから3日たったあとの次の成功でまた出す（`postponedUntil`）。［表示しない］は `closed` にするが、アップデート（`onInstalled` の `update`、読み込み直しも含む）で取り消し、そこから3日たったあとにまた出す。［ストアで評価する］を押した人は `rated` を記録し、アップデートしても出さない。状態は chrome.storage.local の `reviewPrompt`、起点は `installedAt`（service worker が起きるたびに、なければ記録。この仕組みより前からの利用者は最初に動いたときが起点）。設定ではないのでファクトリーリセットでは消さない。
- **ツールバーアイコンの色**: 線の色は `#7465e0`。もとの淡い色（`#8578eb` 系・16px は半透明）ではライトモードのツールバーでほぼ見えなかったため、全サイズ（`assets/icon*.png`・`icon-source.png`）を濃くし、16px は不透明度も上げている。
- **ポップアップの高さ**: 初期状態でスクロールが出ないよう余白を詰めるが、`.popup-root` の `max-height: 560px` / `overflow-y: auto` は外さない。日本語のフォールバックフォントは行高 `normal` が大きく ja だけはみ出したため、`body` の `line-height` を 1.35 に固定している（計測値: Windows の ja で 511px）。E2E で en / ja とも初期状態でスクロールが出ないことを確認している。

## バージョン・リリース

- 作業中は `package.json` の `version` を変更しない。全実装と確認が終わり、完了を報告する直前に1回だけ上げる（バグ修正・微調整は PATCH、機能追加は MINOR、全面刷新・権限の大幅変更は MAJOR）。
- 1.0.0 で正式版になった（2026-11-06）。ZIP 名とタグは `-beta.<n>` なし。
- `version` は必ず3桁の整数（`MAJOR.MINOR.PATCH`）。プレリリース表記や4桁は Plasmo のビルドエラーになるので禁止。ベータ版であることは ZIP 名・README・Git タグで表す（`window-resizer-screenshot-v0.2.1-beta.2.zip`）。
- ドキュメントのみの変更ではバージョン更新もビルドも不要。
- リリース後のストア更新と LP 更新は `/publish` で行う。ストア掲載の資料（説明文・プライバシー・画像）と LP の本文（`store/lp/page.{ja,en}.html`）の正本は `store/`。
- LP（うしブロの固定ページ 10268／10273）を本番で直すときだけは、このリポジトリの外の `F:\claude\ai-ushiblo` のスクリプトとルールを使い、作業ログもそちらに残す（2026-10-31 ユーザーの指示）。それ以外で親フォルダや他のリポジトリには触れない。

## README

- `README.md` と `README.en.md` は常に両方を同じ内容で更新する。公開向けの文書なので、進捗ログや ToDo を書かない。
- 構成と順序を崩さない: 概要 → バグ報告（GitHub Issues へのリンク）→ 技術スタック/ディレクトリ構成 → インストール・開発手順 → 仕様と制約事項 → Changelog（表形式、最新を最上部に追記）→ ライセンス（商用利用・再配布・転売の禁止、個人利用は自由）。
- 最下部の「開発を応援する」（英語版は Support development）セクションと `.github/funding.yml` は維持する。
