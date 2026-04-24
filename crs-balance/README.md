# crs-balance

Claude Code 插件，用于查看 CRS 上游 Claude 账号的 5h / 7d 使用量，并可集成到 Claude Code statusLine。

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

## 配置

推荐写入 `~/.claude/crs-balance.env`；一键安装脚本会自动创建模板，`crs-statusline` 会自动读取它：

```bash
export CRS_BASE_URL=https://250924.xyz
export CRS_ADMIN_USER=admin
export CRS_ADMIN_PASS='your_password'

# 三选一。推荐用精确账号名或账号 id，避免展示全部账号。
export CRS_ACCOUNT_NAME='your_account_name'
# export CRS_ACCOUNT_ID='your_account_id'
# export CRS_ACCOUNT_FILTER='name_or_id_fragment'
```

可选配置：

```bash
export CRS_CACHE_SECONDS=300
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

示例：

```text
crs › bob-opus · 5h ▓░░░░░░░░░ 12% reset 1.6h · 7d ▓▓▓▓▓▓▓░░░ 68% reset 1.3d
```

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
- `--account-name <name>`：精确匹配账号名。
- `--account-filter <text>`：按账号 id 或名称片段匹配。
- `--all`：展示全部账号。
