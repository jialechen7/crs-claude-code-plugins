# crs-balance

Claude Code 插件，用于查看上游 Claude 账号的 5h / 7d 使用量，并可集成到 Claude Code statusLine。

支持两个后端，按 `~/.claude/settings.json` 里 `ANTHROPIC_AUTH_TOKEN` 的前缀自动识别 token 归属：

- `cr_xxx` → CRS（`/stats/key/<token>`）
- `sk-xxx` → crs2 / sub2api（`/stats/crs2/key/<token>`）

识别账号后会查询 `/stats/aggregate/account/<account>` 获取账号聚合用量。同一个账号同时挂在 CRS 与 crs2/sub2api 下时，两个平台的 key 都会看到合并后的账号用量，以及基于聚合总量计算出的 `mine` 占比。状态栏首词仍标明当前 token 来自 `crs` / `crs2`。

## 安装

推荐使用仓库根目录的一键安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/jialechen7/crs-claude-code-plugins/main/install.sh | bash
```

手动安装：

```bash
claude plugin marketplace add https://github.com/jialechen7/crs-claude-code-plugins.git
claude plugin install crs-balance@crs-tools --scope user
```

已安装用户升级后，如果 statusLine 被其他插件覆盖，在 Claude Code 中运行 `/crs-balance:statusline-repair`。

## 配置

推荐写入 `~/.claude/crs-balance.env`；一键安装脚本会自动创建模板，`crs-balance` 和 `crs-statusline` 都会自动读取它，不需要再写到 `~/.zshrc`：

```bash
export CRS_BASE_URL=https://250924.xyz
export CRS_ADMIN_USER=admin
export CRS_ADMIN_PASS='your_password'

# 按需选择。推荐用精确账号名或账号 id，避免展示全部账号。
export CRS_ACCOUNT_NAME='your_account_name'
# 多账号用逗号分隔：
# export CRS_ACCOUNT_NAMES='account_a,account_b'
# export CRS_ACCOUNT_ID='your_account_id'
# export CRS_ACCOUNT_FILTER='name_or_id_fragment'
```

可选配置：

```bash
export CRS_CACHE_SECONDS=300
# 当前 Claude Code 使用的 CRS key 会优先从 ~/.claude/settings.json 的 ANTHROPIC_AUTH_TOKEN 自动识别。
# 如果自动识别失败，可以显式指定 key id 或 key 名称。
# export CRS_API_KEY_ID='your_api_key_id'
# export CRS_API_KEY_NAME='your_api_key_name'
# export CRS_KEY_SHARE=0
export CRS_NO_COLOR=1
```

## statusLine

一键安装脚本会自动配置。手动配置时，在 `~/.claude/settings.json` 写入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/your_name/.claude/crs-statusline.sh"
  }
}
```

如果已安装 `claude-hud`，`crs-statusline` 会保留原 HUD 输出，并把 CRS 状态放到单独一行。没有安装 `claude-hud` 时，只显示 CRS 行。

如果 `claude-hud` 或其他 statusLine 插件后续覆盖了 `~/.claude/settings.json`，在 Claude Code 中运行：

```text
/crs-balance:statusline-repair
```

该命令会重新创建 `~/.claude/crs-statusline.sh`，保存当前上游 statusLine 命令，并把 `statusLine` 指回 CRS wrapper。完成后重启 Claude Code。

示例：

```text
crs  › bob-opus · 5h ▓░░░░░░░░░ 12% reset 1.6h · 7d ▓▓▓▓▓▓▓░░░ 68% reset 1.3d
crs2 › Max2     · 5h ▓░░░░░░░  3.0% ↻ 4.1h · mine 2.2% · 7d █░░░░░░░ 14.0% ↻ 3.5d · mine 10.3%
```

如果能识别当前 CRS API Key，statusLine 会在 5h 后显示 `mine xx%`，表示当前使用者的 key 在该专属账号当前 5h 窗口内的 token 消耗占整个账号所有 key 消耗的比例。该比例来自账号聚合接口，会合并 CRS 与 crs2/sub2api 两个平台下同名账号的用量。

进度条含义是已使用量：

- teal：使用量 < 50%
- yellow：使用量 50% 到 79%
- red：使用量 >= 80%

## 命令

```bash
crs-balance [--json] [--watch] [--statusline] [--interval seconds] [--base-url url]
```

常用参数：

- `--statusline`：输出 Claude Code statusLine 使用的一行摘要。
- `--json`：输出结构化 JSON。
- `--watch`：按间隔循环刷新。
- `--account-id <id>`：精确匹配账号 id。
- `--account-name <name>`：精确匹配账号名，也支持逗号分隔的多个账号名。
- `--account-names <name1,name2>`：精确匹配多个账号名。
- `--account-filter <text>`：按账号 id 或名称片段匹配。
- `--all`：展示全部账号。
