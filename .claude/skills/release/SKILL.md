---
name: release
description: 作業完了時のバージョン更新・README（日英）の Changelog 追記・ビルド・パッケージング・ベータZIPのリネームを一括で行う。
disable-model-invocation: true
---

引数: $ARGUMENTS（例: `patch beta.1` / `minor beta.1` / `0.3.0 beta.2`。省略時は変更内容から判断してユーザーに確認する）

1. `git status` と `git log main..HEAD --oneline` でこのブランチの変更内容を把握する。`main` 上なら中断してブランチ作成を促す。
2. 次のバージョンを決める。
   - `package.json` の `version` は必ず3桁の整数（`MAJOR.MINOR.PATCH`）。プレリリース表記は書かない。
   - バグ修正・微調整 → PATCH、機能追加 → MINOR（PATCH は0）、全面刷新・権限の大幅変更 → MAJOR。
   - 同じバージョンのベータを重ねる場合（例: `0.2.1` の beta.1 → beta.2）は `version` を変えず、ベータ番号だけ進める。
   - 決めたバージョンとベータ番号をユーザーに確認してから進める。
3. `package.json` の `version` を更新する（`package-lock.json` のルートの `version` も合わせる）。
4. `README.md` と `README.en.md` の両方を更新する。
   - 冒頭の「現在のバージョン」表記と、Changelog 節の説明文中の現在バージョン・ZIP 名の例。
   - Changelog の表の最上部に1行追加（`| 0.2.1（beta.2） | YYYY-MM-DD | 内容 |`。日付は今日）。英語版は既存行の書式に合わせる。
   - 機能や仕様が変わっていれば、概要・ディレクトリ構成・仕様と制約事項も更新する。
   - インストール手順中の ZIP 名の例も新しいバージョンに合わせる。
5. 新機能や仕様変更があれば CLAUDE.md の「機能別の仕様」の該当項目を更新する。
6. `npm run build` → `npm run package` を実行する。
7. `build/chrome-mv3-prod.zip` を `build/window-resizer-screenshot-v<version>-beta.<n>.zip` にコピーする（正式版なら `-beta.<n>` を付けない）。
8. 変更ファイルと生成した ZIP のパスを報告する。コミットは日本語メッセージで、末尾に `（<version>-beta.<n>）` を付ける（例: `...を追加（0.2.1-beta.2）`）。コミット・プッシュはユーザーの指示があるまで行わない。
