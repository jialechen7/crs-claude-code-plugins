---
name: balance
description: 查看 CRS 上游 Claude 账号的 5h、7d、7d Opus 使用率、剩余额度、reset 时间和调度状态。适用于用户询问 CRS 余额、Claude 账号余额、上游账号用量、quota 或 utilization。
allowed-tools: Bash(crs-balance) Bash(crs-balance *)
---

# CRS Balance

当用户要求查看 CRS / Claude 上游账号余额或用量时，运行：

```bash
crs-balance $ARGUMENTS
```

如果用户没有传参数，直接运行 `crs-balance`，输出当前 token 对应账号的 5h / 7d / Opus 用量快照。

## 工作原理

`crs-balance` 直接调用公开只读接口 `https://250924.xyz/stats/key/<token>`，**无需 admin 凭据**。token 自动从 `~/.claude/settings.json` 的 `env.ANTHROPIC_AUTH_TOKEN` 读取，因此只要 Claude Code 已经配好 CRS key 就可以用。

返回内容包括：
- token 关联的账号名称、状态、是否可调度
- 5h 窗口使用率 + 剩余 + reset 倒计时
- 7d 窗口使用率 + 剩余 + reset 倒计时
- 7d Opus 单独的使用率 + reset
- 当前 key 在账号 5h / 7d 用量中的占比（mine）

## 支持的参数

- `--json`：输出结构化 JSON。
- `--watch`：按间隔循环刷新。
- `--interval <seconds>`：配合 `--watch` 设置刷新间隔，默认 60 秒。
- `--statusline`：输出适合 Claude Code statusLine 的单行摘要。
- `--base-url <url>`：覆盖默认 stats API 地址（仅自建 stats 实例时需要）。
- `--token cr_xxx`：显式传 token，跳过自动读 settings.json。
- `--cache-seconds N`：缓存秒数，默认 30。
- `--no-color`：禁用颜色。

## 环境变量

`~/.claude/crs-balance.env` 会被自动读取（不需要写入 `~/.zshrc`）：

- `CRS_BASE_URL`（默认 https://250924.xyz）
- `CRS_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`
- `CRS_CACHE_SECONDS`
- `CRS_NO_COLOR`
- `CRS_BAR_CELLS`（进度条宽度 5–40，默认按终端宽度自适应）
- `CRS_STATUSLINE_MODE`（`full` / `compact` / `mini`，默认按窗口宽度自适应；窗口未知或较窄时落到 `compact`，确保 statusLine 不被截断）
- `CRS_TERM_WIDTH`（手动告诉脚本终端列数，绕过 Claude Code 子进程拿不到 columns 的限制）

## 旧版本兼容性

0.4.0 起，以下配置项已不再需要，存在也会被忽略：`CRS_ADMIN_USER` / `CRS_ADMIN_PASS` / `CRS_ACCOUNT_*` / `CRS_API_KEY_ID` / `CRS_API_KEY_NAME` / `--user` / `--password` / `--account-*` / `--api-key-*` / `--all` / `--no-key-share`。

token 已唯一定位单个账号，不再需要账号筛选。
