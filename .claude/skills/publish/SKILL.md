---
name: publish
description: release でバージョン更新・ZIP 作成を終えたあと、Chrome ウェブストアの更新（アップロード・説明文（日英）・プロモ画像・その他の掲載項目）と、うしブロの拡張機能LPの更新を、決まった順で進める。
disable-model-invocation: true
---

前提: `/release` が完了し、`main` にマージ済みであること。ストアのダッシュボードはユーザーのログインが必要なので、アップロードと審査への送信はユーザーが行う（Claude は資料の作成まで）。LP は Claude が ai-ushiblo の仕組みで本番に修正版の下書き（Rewrite & Republish のコピー）を作るところまで行い、確認と再公開はユーザーが行う。

## 1. アップロード用アーカイブの確認

1. `build/chrome-mv3-prod.zip` は `npm run package` 実行時点の `build/chrome-mv3-prod` から作られる。`npm run build` だけ実行した後は古い ZIP が残るので、必ず中の `manifest.json` の `version` を確認する（`unzip -p build/chrome-mv3-prod.zip manifest.json`）。
2. 中身が 16 ファイル前後で、`licenses/LICENSE-tabler.txt`・`_locales/{en,ja}/messages.json`・アイコン 5 サイズが入っていること、`.map` やテスト用の `host_permissions` が入っていないことを確認する。
3. `build/window-resizer-screenshot-v<version>-beta.<n>.zip` が同じ内容（サイズ一致）であることを確認する。
4. ストアで現在公開中のバージョン（ストアページの「バージョン」）を確認し、README の Changelog と照らして **ストア未反映の変更をすべて** 洗い出す。途中のバージョンをアップロードしていない場合は、それらの変更もまとめて説明文に反映する。

## 2. ストアの更新

ダッシュボード: https://chrome.google.com/webstore/devconsole （アイテム ID `kaikockbajglbkgoeepfbamdknadhiji`）

1. **説明文（日英）**: `store/description.ja.txt` / `store/description.en.txt` が掲載文の正本。洗い出した変更を両方に同じ内容で追記し、ユーザーに確認してもらう。ダッシュボードには言語を切り替えてそれぞれ貼り付ける。
   - 短い説明（概要の1行）は `assets/_locales/{en,ja}/messages.json` の `extensionDescription` から自動で入る（132 文字以内）。変える場合はコード変更なので release からやり直す。
2. **プロモ画像**: `store/images/` に置く。スクリーンショットは 1280×800（または 640×400）、最大 5 枚。小さいプロモタイル 440×280、マーキー 1400×560 は任意。新機能が見た目に関わる場合は、該当画面のスクリーンショットを差し替え・追加する。
   - スクリーンショット（`store/images/screenshot-1〜5.png`、1280×800）も全言語共通なので英語で作る。`npm run build` の後、作業フォルダ `<work>` に LP の図解（`wvr-diagram-window.png` / `wvr-diagram-viewport.png`）を置き、`node store/screenshots/shoot-store.cjs "$PWD" <work>`（デモ用の管理画面 `demo-page.html` での範囲選択 UI・拡大率の確認・設定画面を撮影）→ `node store/screenshots/render-slides.cjs "$PWD" <work> store/images`。見出しと説明文は `store/screenshots/slides.html`。1枚目は `store/lp/images/wvr-step-2-en.png` を使うので、LP 画像を先に作る。
   - 小さいプロモタイルはダッシュボードに言語別の欄がなく全言語共通なので、英語版（`store/images/promo-tile-440x280.en.png`）を使う。ja 版は予備。タイルは `store/promo/` から作り直せる。作業用の空フォルダ `<work>` に `store/promo/tile.html` と `assets/icon128.png` をコピーし、`npm run build` の後に `node store/promo/shoot.cjs "$PWD" <work>`（本番ビルドのポップアップを ja/en・light/dark で 3 倍撮影。表示中のサイズ値は 1920 x 1080 / 1920 x 951 に差し替え）→ `node store/promo/render.cjs "$PWD" <work> store/images`（440×280 を書き出し、確認用の @2x は `<work>` に出る）。ポップアップの見た目が変わったときに作り直す。
3. **その他の掲載項目の確認**:
   - 「プライバシーへの取り組み」の正本は `store/privacy.md`（英語を貼り付け、日本語は確認用）。権限を変えたときは権限の用途を更新する。権限が同じでも、用途が増えた場合（例: `scripting` で範囲選択 UI を注入）は追記する。
   - 単一用途の説明・データ使用の申告・リモートコードの有無が現状と合っているか。
   - URL 欄: 公式 URL は Search Console で確認済みのプロパティしか選べない。LP のページ URL そのものを URL プレフィックスのプロパティとして Search Console に登録すれば、パス付きで選べる（日英の LP を登録済み。公式 URL は1つだけなので、どちらかを選ぶ）。新しい拡張機能の LP も同じ方法で登録する（サブドメインは不要）。ストアページに出る外部リンクはこれとサポート URL（GitHub Issues）だけで、ホームページ URL（LP のページ URL を入力済み）は現行のストアには表示されない（2026-10 時点で確認）。
   - ベータ版表記（説明文末尾）を残すかどうか。
4. **アップロード**: パッケージ → 新しいパッケージをアップロード で手順 1 の ZIP を選ぶ。説明文・画像を保存してから「審査のため送信」（ユーザーが押す）。

## 3. うしブロの拡張機能LP

LP は本番の固定ページ **10268**（https://www.ushiblo.com/window-viewport-resizer/ ）と **10273**（英語版 https://www.ushiblo.com/en/window-viewport-resizer-en/ 、Polylang で紐づけ済み）。日英両方を同じ内容で直す。本文は WordPress のカスタム HTML ブロック1つ（`<div class="wvr">…</div>`）で、CSS はページのメタ `_custom_css`（日英で同じ。正本は `store/lp/page.css`）。CSS を変えるときは Rewrite & Republish のコピーに `scripts/wp.sh prod post meta update <コピーID> _custom_css < store/lp/page.css` で入れる（Republish でメタも元のページに反映される）。PC と幅 375px で表示を確かめてから入れる。

### 本番の操作は ai-ushiblo（`F:\ai-ushiblo`）の仕組みとルールで行う

- サイトの運用ルールの正本は `F:\ai-ushiblo\CLAUDE.md`（接続は `docs/environment.md`、Rewrite & Republish・Polylang は `docs/plugins.md`）。作業前に読み、そのとおりに行う。ここに書いた手順と食い違ったら ai-ushiblo を優先する。
- コマンドは `cd /f/ai-ushiblo && scripts/wp.sh prod …` のように ai-ushiblo のスクリプトを使う（SSH 接続名 `coreserver-wp`。接続を拒否されたら自宅 IP の変更を疑い、ユーザーに伝える）。
- サーバーで何かを変えたら、ai-ushiblo の `logs/YYYY-MM.md` の末尾に同じ書式で追記し、人の確認待ちは `docs/status.md` に書いて、ai-ushiblo でコミットする（同リポジトリの Git のルールに従う。プッシュは指示があってから）。
- 公開・再公開はユーザーの指示があるときだけ。パスワード類はどこにも書かない。

### 手順

1. **本文の取り込み**: `scripts/wp.sh prod post get <ID> --field=post_content` で日英の現行版を取得し、`store/lp/page.ja.html` / `page.en.html`（LP の正本）と比べる。差分があれば人がエディタで直したものなので、取得した版で上書きしてコミットしてから作業する。
2. **変更点の洗い出しと文案**: 手順 1 の変更一覧と突き合わせ、変える箇所を `store/lp/<version>.md` に日英でまとめる（場所 → 操作 → 文案。前回分を書式の手本にする）。ユーザーに確認してもらう。
3. **画像**: ポップアップやアイコンの見た目が変わったときは、`store/lp/shoot-lp.cjs` → `store/lp/render-lp.cjs` で差し替え画像（冒頭のポップアップ・ステップ2・3、日英）を `store/lp/images/` に作る。ステップ画像は LP の旧画像のポップアップ部分を覆って作るので、旧画像を LP からダウンロードして作業フォルダに置く（詳細は直近の `store/lp/<version>.md` の「画像」節）。
4. **本文の修正**: 文案を `store/lp/page.*.html` に反映する。差し替え画像の URL は取り込み後の名前（`…/images/<年>/<月>/<名前>-<版>.webp`）にする。「最新バージョン」の行を更新する。説明は `store/description.*.txt` と表現をそろえる。機能カードは2列、ペルソナは4列の前提の CSS。
5. **本番での下書き作成**（ai-ushiblo の「公開済みの記事の修正」と「画像の取り込みと差し込み」の手順）:
   1. 既存の Rewrite & Republish のコピーがないか確かめる（あれば人が作業中かもしれないので、触る前にユーザーに確認）
   2. `scripts/snapshot-post.sh prod 10268`・`… 10273`、`scripts/backup-db.sh prod`
   3. 画像を版付きの名前（例 `wvr-step-2-040.png`）で `scp` → `~/tmp/img-import/`、`scripts/wp.sh prod media import /home/ushiblo/tmp/img-import/<ファイル> --title=… --alt=… --porcelain`（`--post_id` は付けない。ushiblo WebP が `.webp` に変える）。`wp post get <添付ID> --field=guid` などで URL を確かめ、本文の URL と合わせる。サーバーの `~/tmp/img-import/` の取り込んだファイルは消す
   4. コピーを作る（`docs/plugins.md` の `create_duplicate_for_rewrite_and_republish`）。`post_author` が元と同じか確かめる
   5. `scripts/wp.sh prod post update <コピーID> - < store/lp/page.<lang>.html`。`parse_blocks` でブロック数（html 1・paragraph 1 と空ブロック）を確かめる
   6. ai-ushiblo のログ・status に書いてコミット。ユーザーにコピーの ID と編集画面の URL（`https://www.ushiblo.com/wp-admin/post.php?post=<コピーID>&action=edit`）を渡す
6. **ユーザー**: エディタのプレビューで確認し、「Republish」で反映。反映後、Claude は ai-ushiblo のログに完了を書き、status から消す。`store/lp/page.*.html` と本番の本文が一致するか確かめる。

## 4. 後片付け

- `store/` の更新を `main` にコミット（日本語メッセージ、末尾に `（<version>-beta.<n>）`）。Git タグ `v<version>-beta.<n>` を付ける。コミット・プッシュ・タグはユーザーの指示があってから。
- 今回の作業で手順に漏れや変更があれば、このファイルを更新する。
