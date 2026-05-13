# crs-claude-code-plugins

Claude Code 插件 marketplace，目前包含：

- `crs-balance`：查看 CRS 上游 Claude 账号 5h / 7d 使用量，并可集成到 Claude Code statusLine。

## 0.4.0 重要变更

从 0.4.0 起，**插件不再需要 CRS admin 账号密码**。token（你已配在 Claude Code 里的 `cr_xxx`）即唯一凭据：插件读 `~/.claude/settings.json` 里的 `env.ANTHROPIC_AUTH_TOKEN`，调用公开只读接口 `https://250924.xyz/stats/key/<token>` 拿 token 关联账号的 5h / 7d 用量。

> 数据完全限定在你自己的 token 关联的账号范围内，无法看到别人账号。

升级时旧 `~/.claude/crs-balance.env` 文件不动也能用，里面的 `CRS_ADMIN_*` / `CRS_ACCOUNT_*` / `CRS_API_KEY_ID/NAME` 等会被静默忽略。

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/jialechen7/crs-claude-code-plugins/main/install.sh | bash
```

安装脚本会完成：

- 添加 `crs-tools` marketplace
- 安装 `crs-balance@crs-tools`
- 创建 `~/.claude/crs-balance.env` 模板（默认空白，token 自动识别）
- 创建稳定 wrapper `~/.claude/crs-statusline.sh`
- 自动写入 `~/.claude/settings.json` 的 `statusLine`
- 检测到旧 admin 配置时打印迁移提示

也可以手动安装：

```bash
claude plugin marketplace add https://github.com/jialechen7/crs-claude-code-plugins.git
claude plugin install crs-balance@crs-tools --scope user
```

## 使用

Claude Code 中调用：

```text
/crs-balance:balance
```

或直接命令行：

```bash
crs-balance              # 表格输出
crs-balance --json       # JSON 输出
crs-balance --statusline # statusLine 单行
crs-balance --watch      # 循环刷新
```

## 配置（可选）

绝大多数情况下不需要任何配置，token 会自动识别。如果有特殊需求，编辑 `~/.claude/crs-balance.env`：

```bash
# 自建 stats 实例时覆盖
# export CRS_BASE_URL=https://250924.xyz

# 显式指定 token（settings.json 里没有时）
# export CRS_API_KEY=cr_xxx

# 缓存秒数（statusLine 高频调用时建议保留）
# export CRS_CACHE_SECONDS=30
```

## 升级现有用户的 statusLine

如果其他插件（如 `claude-hud`）把 `statusLine` 踹掉了，在 Claude Code 中运行：

```text
/crs-balance:statusline-repair
```

## 与其他 statusLine 插件共存

Claude Code 的 `settings.json` 里 `statusLine` 字段全局唯一,装多个 statusLine 插件会互相覆盖。本插件采用**包装而非覆盖**策略:

- 安装时如果检测到 `statusLine.command` 已经被别的插件占用(例如 `claude-hud`),会把那条命令保存到 `~/.claude/crs-statusline.upstream`,然后把 `statusLine` 指向本插件 wrapper。
- 运行时本插件 wrapper 会先用同一份 stdin 跑 upstream 命令,再 append 自己的输出,两段内容用换行拼接显示。
- 如果之后其他插件的 setup(如 `/claude-hud:setup`)再次踹掉了本插件的 wrapper,运行 `/crs-balance:statusline-repair` 或重新跑一次一键安装脚本即可恢复。

如果想撤掉接管关系,删掉 `~/.claude/crs-statusline.upstream` 即可。
