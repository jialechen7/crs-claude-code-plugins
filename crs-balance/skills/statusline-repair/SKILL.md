---
name: statusline-repair
description: 修复 CRS statusLine 接管关系。适用于 claude-hud 或其他插件覆盖 ~/.claude/settings.json 的 statusLine 后，恢复 CRS 与上游 statusline 共存。
allowed-tools: Bash(crs-statusline-repair)
---

# CRS Statusline Repair

当用户要求修复 CRS statusline、恢复 CRS 状态栏、或说明 claude-hud 覆盖了 CRS statusline 时，运行：

```bash
crs-statusline-repair
```

该命令会：

- 创建或更新稳定 wrapper：`~/.claude/crs-statusline.sh`
- 如果当前 `statusLine.command` 指向其他插件，保存为 `~/.claude/crs-statusline.upstream`
- 将 `~/.claude/settings.json` 的 `statusLine` 指回 CRS wrapper

运行完成后，提示用户重启 Claude Code。
