#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_URL="${CRS_MARKETPLACE_URL:-https://github.com/jialechen7/crs-claude-code-plugins.git}"
PLUGIN_ID="crs-balance@crs-tools"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ENV_FILE="${CRS_ENV_FILE:-$CONFIG_DIR/crs-balance.env}"
WRAPPER="$CONFIG_DIR/crs-statusline.sh"
UPSTREAM_FILE="$CONFIG_DIR/crs-statusline.upstream"
SETTINGS="$CONFIG_DIR/settings.json"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

need claude
need node

mkdir -p "$CONFIG_DIR"

echo "==> 添加 CRS Claude Code marketplace"
claude plugin marketplace add "$MARKETPLACE_URL" >/dev/null || true

echo "==> 安装 CRS balance 插件"
if claude plugin list --json | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  const xs = JSON.parse(s || "[]");
  process.exit(xs.some(x => x.id === "crs-balance@crs-tools") ? 0 : 1);
});
'; then
  claude plugin update "$PLUGIN_ID" --scope user >/dev/null || true
else
  claude plugin install "$PLUGIN_ID" --scope user >/dev/null
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> 创建配置模板: $ENV_FILE"
  cat > "$ENV_FILE" <<'ENV'
# CRS balance 插件配置。填完后重启 Claude Code。
export CRS_BASE_URL="https://250924.xyz"
export CRS_ADMIN_USER="admin"
export CRS_ADMIN_PASS="your_password"

# 三选一。推荐用精确账号名或账号 id，避免展示全部账号。
export CRS_ACCOUNT_NAME="your_account_name"
# export CRS_ACCOUNT_ID="your_account_id"
# export CRS_ACCOUNT_FILTER="name_or_id_fragment"

# 可选项
export CRS_CACHE_SECONDS="300"
# export CRS_NO_COLOR="1"
ENV
  chmod 600 "$ENV_FILE"
else
  echo "==> 保留已有配置: $ENV_FILE"
fi

echo "==> 创建稳定 statusLine wrapper: $WRAPPER"
cat > "$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
set -u

config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
env_file="${CRS_ENV_FILE:-$config_dir/crs-balance.env}"

if [[ -f "$env_file" ]]; then
  # shellcheck disable=SC1090
  source "$env_file"
fi

status_bin="$(
  ls -d "$config_dir"/plugins/cache/crs-tools/crs-balance/*/bin/crs-statusline 2>/dev/null |
    awk -F/ '{ print $(NF-2) "\t" $(0) }' |
    sort -t. -k1,1n -k2,2n -k3,3n -k4,4n |
    tail -1 |
    cut -f2-
)"

if [[ -n "${status_bin:-}" && -x "$status_bin" ]]; then
  exec "$status_bin"
fi

echo "crs 未安装"
WRAP
chmod +x "$WRAPPER"

echo "==> 配置 Claude Code statusLine"
node - "$SETTINGS" "$WRAPPER" "$UPSTREAM_FILE" <<'NODE'
const fs = require("fs");
const [settingsPath, wrapper, upstreamFile] = process.argv.slice(2);
let data = {};
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, "utf8").trim();
  data = raw ? JSON.parse(raw) : {};
}

// 接管原 statusLine:如果当前指向的不是 crs wrapper,就把它当作上游保存。
// 仅在上游文件不存在时写入 — 否则反复跑 install.sh 会把 crs wrapper 自己存为上游,造成递归。
const existing = data.statusLine && typeof data.statusLine.command === "string" ? data.statusLine.command.trim() : "";
if (existing && existing !== wrapper && !fs.existsSync(upstreamFile)) {
  fs.writeFileSync(upstreamFile, existing + "\n");
  console.log(`==> 已接管原 statusLine 命令到 ${upstreamFile}`);
}

data.statusLine = {
  type: "command",
  command: wrapper,
};
fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2) + "\n");
NODE

printf '\n安装完成。\n\n'
printf '下一步：\n'
printf '1. 编辑 %s，填入 CRS_ADMIN_PASS 和账号筛选。\n' "$ENV_FILE"
printf '2. 重启 Claude Code。\n\n'
printf '配置文件权限已设置为 600；不要把该文件提交到 git。\n'
