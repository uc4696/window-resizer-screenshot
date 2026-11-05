#!/usr/bin/env bash
#
# E2E を WSL2 の Ubuntu と xvfb で実行する。Windows の画面にブラウザを出さず、
# Windows のクリップボードにも触れない。GitHub Actions（e2e-beta.yml）と同じ動かし方にしている。
#
# 使い方（Windows のターミナルから。作業中のファイルがそのままテストされる）:
#   npm run test:e2e:wsl
#   npm run test:e2e:wsl -- tests/e2e/clipboard.spec.ts       # 引数は Playwright に渡す
#   npm run test:e2e:wsl -- --channel beta                    # Chrome のチャンネルを変える
#   npm run test:e2e:wsl -- --update-browser                  # Chrome を最新に取り直す
#
# 流れ: rsync で ~/e2e/<名前> に同期 → 必要なら npm ci → ビルド → 必要なら Chrome を取得
#       → xvfb 上で実行 → test-results などを Windows 側に戻す。終了コードはテストのものを返す。
#
# 別のプロジェクトに流用するときは、このファイルを複製して「プロジェクトごとの設定」を変え、
# package.json に "test:e2e:wsl": "wsl.exe -d Ubuntu -e bash scripts/e2e-wsl.sh" を足す。
# .gitattributes の `*.sh text eol=lf` も必要（CRLF だと bash が読めない）。

set -euo pipefail

# ---- プロジェクトごとの設定 ----------------------------------------------------------
PROJECT_NAME="resizer"
NODE_MAJOR="24" # e2e-beta.yml の node-version と揃える
BUILD_CMD=(npm run build)
BROWSER_INSTALL_CMD=(npm run test:install-browser)
BROWSER_PATH_FILE=".chrome-for-testing/executable-path.txt"
TEST_CMD=(npm run test:e2e --)
# テスト結果の場所。実行後に Windows 側の同じ場所へ戻す
RESULT_DIRS=(test-results playwright-report)
# 同期しないもの（先頭の / はプロジェクトのルートを指す）。RESULT_DIRS は自動で除外する
SYNC_EXCLUDES=(
  /.git/
  /.claude/
  /node_modules/
  /.plasmo/
  /build/
  /.chrome-for-testing/
  /store/
)
# --------------------------------------------------------------------------------------

log() { printf '\n[e2e-wsl] %s\n' "$*"; }
die() {
  printf '\n[e2e-wsl] エラー: %s\n' "$*" >&2
  exit 1
}

[[ "$(uname -s)" == "Linux" ]] || die "WSL の中で実行してください（Windows からは npm run test:e2e:wsl）。"

# ---- 引数 -----------------------------------------------------------------------------
channel="${CHROME_CHANNEL:-stable}"
update_browser=0
test_args=()
while (($# > 0)); do
  case "$1" in
    --channel)
      (($# >= 2)) || die "--channel にチャンネル名を指定してください。"
      channel="$2"
      shift 2
      ;;
    --update-browser)
      update_browser=1
      shift
      ;;
    *)
      # Windows のターミナルの補完で付く tests\e2e\x.spec.ts や .\tests\... を直して渡す
      arg="${1//\\//}"
      arg="${arg#./}"
      if [[ -e "$arg" ]]; then test_args+=("$arg"); else test_args+=("$1"); fi
      shift
      ;;
  esac
done

# ---- Node ------------------------------------------------------------------------------
# WSL の PATH には Windows の npm（/mnt/c/...）が見えているので、PATH を作り直して確実に外す。
node_dir="$(ls -d "$HOME"/.nvm/versions/node/v"$NODE_MAJOR".* 2>/dev/null | sort -V | tail -n 1 || true)"
if [[ -z "$node_dir" ]]; then
  die "Linux の Node $NODE_MAJOR がありません。WSL で次を実行してください:
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | PROFILE=/dev/null bash
  PATH=/usr/bin:/bin bash -c '. ~/.nvm/nvm.sh && nvm install $NODE_MAJOR'"
fi
export PATH="$node_dir/bin:/usr/local/bin:/usr/bin:/bin"
[[ "$(command -v npm)" == "$node_dir/bin/npm" ]] || die "Linux の npm が使われていません: $(command -v npm)"
for cmd in rsync xvfb-run xauth flock sha256sum; do
  command -v "$cmd" >/dev/null || die "$cmd がありません。WSL に入れてください（sudo apt install）。"
done

# ---- 場所 -----------------------------------------------------------------------------
src_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$HOME/e2e/$PROJECT_NAME"
mkdir -p "$work_dir"

# 同じ作業用コピーを2つの実行で同時に使わないようにする（別のセッションの実行を待つ）
exec 9>"$work_dir.lock"
if ! flock -n 9; then
  log "別の実行が終わるのを待っています..."
  flock 9
fi

# ---- 同期 -----------------------------------------------------------------------------
excludes=()
for pattern in "${SYNC_EXCLUDES[@]}"; do excludes+=(--exclude "$pattern"); done
for dir in "${RESULT_DIRS[@]}"; do excludes+=(--exclude "/$dir/"); done

log "同期: $src_dir -> $work_dir"
rsync -rlt --delete "${excludes[@]}" "$src_dir/" "$work_dir/"
cd "$work_dir"

# ---- 依存関係（package-lock.json か Node の ABI が変わったときだけ入れ直す） -----------
deps_stamp="node_modules/.e2e-wsl-deps"
deps_key="$(sha256sum package-lock.json | cut -d' ' -f1) $(node -p process.versions.modules)"
if [[ ! -f "$deps_stamp" || "$(cat "$deps_stamp")" != "$deps_key" ]]; then
  log "npm ci（$(node -v) / npm $(npm -v)）"
  npm ci
  printf '%s' "$deps_key" >"$deps_stamp"
else
  log "依存関係は変更なし（npm ci を省略）"
fi

# ---- ビルド ----------------------------------------------------------------------------
log "ビルド: ${BUILD_CMD[*]}"
"${BUILD_CMD[@]}"

# ---- Chrome ----------------------------------------------------------------------------
channel_stamp="$(dirname "$BROWSER_PATH_FILE")/.e2e-wsl-channel"
browser_ok=0
if [[ -f "$BROWSER_PATH_FILE" && -f "$channel_stamp" ]]; then
  if [[ -x "$(cat "$BROWSER_PATH_FILE")" && "$(cat "$channel_stamp")" == "$channel" ]]; then
    browser_ok=1
  fi
fi
if ((update_browser == 1 || browser_ok == 0)); then
  log "Chrome を取得: $channel"
  # @puppeteer/browsers は ZIP の展開に unzip を使う
  command -v unzip >/dev/null || die "unzip がありません。WSL で sudo apt install unzip を実行してください。"
  CHROME_CHANNEL="$channel" "${BROWSER_INSTALL_CMD[@]}"
  printf '%s' "$channel" >"$channel_stamp"
fi

# ---- 実行 ------------------------------------------------------------------------------
# WSLg（DISPLAY=:0 / wayland-0）に出ると Windows の画面にウィンドウが出て、クリップボードも
# Windows と同期される。xvfb-run が DISPLAY を仮想画面に向けるので、WSLg につながる変数は
# ここで消す。Chrome は WAYLAND_DISPLAY などがあると Wayland を選ぶことがある。
unset WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_SESSION_TYPE PULSE_SERVER DISPLAY

# 仮想画面の外に出ていないことを、テストの直前に xvfb-run の内側で確かめる
guard='case "${DISPLAY:-}" in :0|:0.*|"") echo "[e2e-wsl] DISPLAY=${DISPLAY:-} は仮想画面ではありません" >&2; exit 1;; esac
[ -z "${WAYLAND_DISPLAY:-}" ] || { echo "[e2e-wsl] WAYLAND_DISPLAY が残っています" >&2; exit 1; }
echo "[e2e-wsl] 仮想画面 DISPLAY=$DISPLAY / $("$(cat "$0")" --version)"
exec "$@"'

log "テスト実行（Chrome $channel / xvfb）"
started=$SECONDS
status=0
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
  bash -c "$guard" "$BROWSER_PATH_FILE" "${TEST_CMD[@]}" ${test_args[@]+"${test_args[@]}"} ||
  status=$?
elapsed=$((SECONDS - started))

# ---- 結果を Windows 側に戻す -----------------------------------------------------------
# 戻せなくてもテストの終了コードは変えない
for dir in "${RESULT_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    rsync -rlt --delete "$dir/" "$src_dir/$dir/" ||
      printf '[e2e-wsl] 警告: %s を Windows 側に戻せませんでした\n' "$dir" >&2
  fi
done

if ((status == 0)); then
  log "成功（テスト ${elapsed} 秒、全体 ${SECONDS} 秒）"
else
  log "失敗（終了コード $status、テスト ${elapsed} 秒、全体 ${SECONDS} 秒）"
  log "trace とスクリーンショット: $(wslpath -w "$src_dir")\\test-results（npx playwright show-trace <trace.zip> で開く）"
fi
exit "$status"
