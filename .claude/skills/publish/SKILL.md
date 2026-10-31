---
name: publish
description: release でバージョン更新・ZIP 作成を終えたあと、Chrome ウェブストアの更新（アップロード・説明文（日英）・プロモ画像・その他の掲載項目）と、うしブロの拡張機能LPの更新を、決まった順で進める。
disable-model-invocation: true
---

前提: `/release` が完了し、`main` にマージ済みであること。ストアのダッシュボードとブログ管理画面はユーザーのログインが必要なので、アップロード・送信・公開ボタンはユーザーが押す（Claude は資料の作成と差分の洗い出しまで）。

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
   - 小さいプロモタイルはダッシュボードに言語別の欄がなく全言語共通なので、英語版（`store/images/promo-tile-440x280.en.png`）を使う。ja 版は予備。タイルは `store/promo/` から作り直せる。作業用の空フォルダ `<work>` に `store/promo/tile.html` と `assets/icon128.png` をコピーし、`npm run build` の後に `node store/promo/shoot.cjs "$PWD" <work>`（本番ビルドのポップアップを ja/en・light/dark で 3 倍撮影。表示中のサイズ値は 1920 x 1080 / 1920 x 951 に差し替え）→ `node store/promo/render.cjs "$PWD" <work> store/images`（440×280 を書き出し、確認用の @2x は `<work>` に出る）。ポップアップの見た目が変わったときに作り直す。
3. **その他の掲載項目の確認**:
   - 「プライバシーへの取り組み」の正本は `store/privacy.md`（英語を貼り付け、日本語は確認用）。権限を変えたときは権限の用途を更新する。権限が同じでも、用途が増えた場合（例: `scripting` で範囲選択 UI を注入）は追記する。
   - 単一用途の説明・データ使用の申告・リモートコードの有無が現状と合っているか。
   - URL 欄: 公式 URL は Search Console で確認済みのプロパティしか選べない。LP のページ URL そのものを URL プレフィックスのプロパティとして Search Console に登録すれば、パス付きで選べる（日英の LP を登録済み。公式 URL は1つだけなので、どちらかを選ぶ）。新しい拡張機能の LP も同じ方法で登録する（サブドメインは不要）。ストアページに出る外部リンクはこれとサポート URL（GitHub Issues）だけで、ホームページ URL（LP のページ URL を入力済み）は現行のストアには表示されない（2026-10 時点で確認）。
   - ベータ版表記（説明文末尾）を残すかどうか。
4. **アップロード**: パッケージ → 新しいパッケージをアップロード で手順 1 の ZIP を選ぶ。説明文・画像を保存してから「審査のため送信」（ユーザーが押す）。

## 3. うしブロの拡張機能LP

LP: https://www.ushiblo.com/window-viewport-resizer/ （英語版 https://www.ushiblo.com/en/window-viewport-resizer-en/ ）。日英両方を同じ内容で直す。

1. LP の現在の本文を取得し、手順 1 の変更一覧と突き合わせて、変更すべき箇所（機能一覧・スクリーンショット・バージョン／更新日・使い方の手順・注意事項・ストアへのリンク）を一覧にしてユーザーに渡す。
2. 修正文案を `store/lp/<version>.md` に日英で書く（場所 → 操作 → 文案。前回分の `store/lp/*.md` を書式の手本にする）。ポップアップの見た目が変わったときは、`store/promo/shoot.cjs` で撮った画像を `store/lp/images/` に置いて差し替え用に渡す。
3. 説明は `store/description.*.txt` と表現をそろえる。「最新バージョン」の行を毎回更新する。

## 4. 後片付け

- `store/` の更新を `main` にコミット（日本語メッセージ、末尾に `（<version>-beta.<n>）`）。Git タグ `v<version>-beta.<n>` を付ける。コミット・プッシュ・タグはユーザーの指示があってから。
- 今回の作業で手順に漏れや変更があれば、このファイルを更新する。
