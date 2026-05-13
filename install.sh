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

# 0.4.0 起不再需要 admin 凭据。但保留检测旧 env 文件,提示迁移。
deprecated_vars=()
if [[ -f "$ENV_FILE" ]]; then
  for v in CRS_ADMIN_USER CRS_ADMIN_PASS CRS_ACCOUNT_ID CRS_ACCOUNT_NAME CRS_ACCOUNT_NAMES CRS_ACCOUNT_FILTER CRS_API_KEY_ID CRS_API_KEY_NAME CRS_KEY_SHARE; do
    if grep -qE "^[[:space:]]*(export[[:space:]]+)?$v=" "$ENV_FILE" 2>/dev/null; then
      deprecated_vars+=("$v")
    fi
  done
fi

env_created=0
if [[ ! -f "$ENV_FILE" ]]; then
  env_created=1
  echo "==> 创建配置模板: $ENV_FILE"
  cat > "$ENV_FILE" <<'ENV'
# CRS balance 插件配置 (0.4.0+, 不再需要 admin 凭据)
# token 默认从 ~/.claude/settings.json 的 env.ANTHROPIC_AUTH_TOKEN 自动读取
# 一般情况下本文件保持空白即可。

# 仅当 stats API 自建实例时才覆盖:
# export CRS_BASE_URL="https://250924.xyz"

# 仅当 settings.json 没有 ANTHROPIC_AUTH_TOKEN 时才显式指定:
# export CRS_API_KEY="cr_xxx"

# 可选:
# export CRS_CACHE_SECONDS="30"
# export CRS_NO_COLOR="1"
ENV
  chmod 600 "$ENV_FILE"
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
if (( ${#deprecated_vars[@]} > 0 )); then
  printf '⚠️  检测到 %s 里存在已废弃的旧配置项:\n' "$ENV_FILE"
  for v in "${deprecated_vars[@]}"; do
    printf '   - %s\n' "$v"
  done

  ans=""
  if [[ -n "${CRS_AUTO_CLEAN_DEPRECATED:-}" ]]; then
    ans="$CRS_AUTO_CLEAN_DEPRECATED"
  elif [[ -r /dev/tty ]]; then
    # 支持 curl ... | bash:从 /dev/tty 读,绕过被 pipe 占用的 stdin
    printf '\n是否自动删除这些行? [y/N] '
    read -r ans </dev/tty || ans=""
  fi

  if [[ "$ans" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    for v in "${deprecated_vars[@]}"; do
      # macOS / Linux 通用:用 .tmp 后缀让 sed -i 兼容两端
      sed -i.tmp -E "/^[[:space:]]*(export[[:space:]]+)?${v}=/d" "$ENV_FILE"
      rm -f "$ENV_FILE.tmp"
    done
    printf '✓ 已删除\n\n'
  else
    printf '   (留着不会报错,只是会被忽略;后续也可以重跑本脚本来清理)\n\n'
  fi
fi
if [[ "$env_created" == "1" ]]; then
  printf '已创建配置模板: %s\n' "$ENV_FILE"
  printf '通常无需编辑;token 会自动从 ~/.claude/settings.json 读取。\n'
fi
printf '重启 Claude Code 后生效。\n'
