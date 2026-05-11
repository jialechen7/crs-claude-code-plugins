#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_URL="${CRS_MARKETPLACE_URL:-https://github.com/jialechen7/crs-claude-code-plugins.git}"
PLUGIN_ID="crs-balance@crs-tools"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ENV_FILE="${CRS_ENV_FILE:-$CONFIG_DIR/crs-balance.env}"

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

env_created=0
if [[ ! -f "$ENV_FILE" ]]; then
  env_created=1
  echo "==> 创建配置模板: $ENV_FILE"
  cat > "$ENV_FILE" <<'ENV'
# CRS balance 插件配置。填完后重启 Claude Code。
export CRS_BASE_URL="https://250924.xyz"
export CRS_ADMIN_USER="admin"
export CRS_ADMIN_PASS="your_password"

# 按需选择。推荐用精确账号名或账号 id，避免展示全部账号。
export CRS_ACCOUNT_NAME="your_account_name"
# 多账号用逗号分隔：
# export CRS_ACCOUNT_NAMES="account_a,account_b"
# export CRS_ACCOUNT_ID="your_account_id"
# export CRS_ACCOUNT_FILTER="name_or_id_fragment"

# 可选项
export CRS_CACHE_SECONDS="300"
# 当前 Claude Code 使用的 CRS key 会优先从 ~/.claude/settings.json 的 ANTHROPIC_AUTH_TOKEN 自动识别。
# 如果自动识别失败，可以显式指定 key id 或 key 名称。
# export CRS_API_KEY_ID="your_api_key_id"
# export CRS_API_KEY_NAME="your_api_key_name"
# export CRS_KEY_SHARE="0"
# export CRS_NO_COLOR="1"
ENV
  chmod 600 "$ENV_FILE"
else
  echo "==> 保留已有配置: $ENV_FILE"
fi

echo "==> 配置 Claude Code statusLine"
repair_bin="$(
  ls -d "$CONFIG_DIR"/plugins/cache/crs-tools/crs-balance/*/bin/crs-statusline-repair 2>/dev/null |
    awk -F/ '{ print $(NF-2) "\t" $(0) }' |
    sort -t. -k1,1n -k2,2n -k3,3n -k4,4n |
    tail -1 |
    cut -f2-
)"
if [[ -z "${repair_bin:-}" || ! -x "$repair_bin" ]]; then
  echo "未找到 crs-statusline-repair，请确认插件安装成功。" >&2
  exit 1
fi
"$repair_bin"

printf '\n安装完成。\n\n'
if [[ "$env_created" == "1" ]]; then
  printf '下一步：\n'
  printf '1. 编辑 %s，填入 CRS_ADMIN_PASS 和账号筛选。\n' "$ENV_FILE"
  printf '2. 重启 Claude Code。\n\n'
else
  printf '已保留现有配置: %s\n' "$ENV_FILE"
  printf '重启 Claude Code 后生效。\n\n'
fi
printf '配置文件权限已设置为 600；不要把该文件提交到 git。\n'
