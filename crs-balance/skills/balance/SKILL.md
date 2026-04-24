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

如果用户没有传参数，直接运行 `crs-balance`，输出当前快照。

## 支持的参数

- `--json`：输出结构化 JSON，适合后续分析。
- `--watch`：按间隔循环刷新。
- `--statusline`：输出适合 Claude Code statusLine 的单行摘要。
- `--interval <seconds>`：配合 `--watch` 设置刷新间隔，默认读取 `CRS_INTERVAL`，否则为 300 秒。
- `--base-url <url>`：覆盖 CRS base URL。
- `--account-id <id>` / `--account-name <name>` / `--account-filter <text>`：只展示指定账号。
- `--all`：忽略账号筛选，展示全部账号。

## 配置来源

优先使用插件安装时填写的 `userConfig`，也兼容环境变量：

- `CRS_BASE_URL`
- `CRS_ADMIN_USER`
- `CRS_ADMIN_PASS`
- `CRS_INTERVAL`
- `CRS_ACCOUNT_ID`
- `CRS_ACCOUNT_NAME`
- `CRS_ACCOUNT_FILTER`

凭据缺失时，不要猜测账号密码；直接提示用户在插件配置或环境变量中补齐。
