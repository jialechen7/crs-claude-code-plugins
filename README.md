# crs-claude-code-plugins

Claude Code 用量插件，支持 CRS、crs2/sub2api 和 Magpie：

- `crs-balance`：在 CLI 状态栏展示 5h、7d 用量及当前 key 的 `mine` 占比。
- `crs-desktop`：在 Claude Desktop 的 Code 本地会话输入框上方展示同样的用量，保留右侧 Context 和其他 Mod 的界面。

Magpie 的 `mine` 是基于网关本地记录和模型价格估算的用量分摊；账号额度来自已有的本地缓存快照。用量查询不会请求 Anthropic。

## 0.6.0 重要变更

从 0.6.0 起，插件会先用当前 token 识别账号，再查询账号聚合接口：

- `https://250924.xyz/stats/aggregate/account/<account>`

当同一个账号同时挂在 CRS 与 crs2/sub2api 两个平台下时，两个平台的 key 都会按聚合后的账号总用量计算 `mine` 占比，不再只看当前 token 所在后端的局部用量。

## 0.5.0 重要变更

从 0.5.0 起，插件**同时支持 CRS 与 crs2 (sub2api)**，按 token 前缀自动识别后端：

- `cr_xxx` → `https://250924.xyz/stats/key/<token>`（CRS）
- `sk-xxx` → `https://250924.xyz/stats/crs2/key/<token>`（crs2 / sub2api）

两者用于识别 token 归属账号，状态栏首词标明 `crs` / `crs2`。无需额外配置。

## 0.4.0 重要变更

从 0.4.0 起，**插件不再需要 CRS admin 账号密码**。token（你已配在 Claude Code 里的 `cr_xxx` 或 `sk-xxx`）即唯一凭据：插件读 `~/.claude/settings.json` 里的 `env.ANTHROPIC_AUTH_TOKEN`，调用公开只读接口拿 token 关联账号的 5h / 7d 用量。

> 数据完全限定在你自己的 token 关联的账号范围内，无法看到别人账号。

升级时旧 `~/.claude/crs-balance.env` 文件不动也能用，里面的 `CRS_ADMIN_*` / `CRS_ACCOUNT_*` / `CRS_API_KEY_ID/NAME` 等会被静默忽略。

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/jialechen7/crs-claude-code-plugins/main/install.sh | bash
```

安装脚本会完成：

- 添加 `crs-tools` marketplace
- 安装或更新 `crs-balance@crs-tools` 和 `crs-desktop@crs-tools`
- 创建 `~/.claude/crs-balance.env` 模板（默认空白，token 自动识别）
- 创建稳定 wrapper `~/.claude/crs-statusline.sh`
- 自动写入 `~/.claude/settings.json` 的 `statusLine`
- 检测到旧 admin 配置时打印迁移提示
- 如果之前安装过 `crs-desktop@crs-desktop-local` 本地试用版，在新插件安装成功后移除旧插件，避免重复展示

也可以手动安装：

```bash
claude plugin marketplace add https://github.com/jialechen7/crs-claude-code-plugins.git
claude plugin install crs-balance@crs-tools --scope user
claude plugin install crs-desktop@crs-tools --scope user
```

手动安装只安装插件；需要设置 CLI 状态栏时，请运行一键脚本。Desktop Mod 依赖已安装的 `crs-balance@crs-tools` 和 Node.js。

### Desktop 使用

在 Claude Desktop 的 **Code → 本地会话**中，用量条会自动显示在输入框上方，每 30 秒刷新一次。新会话会自动加载；安装或更新前已打开的会话运行一次 `/reload-plugins`，或重新启动会话。新建页面尚未启动会话时和 Chat 页面不会显示。

需要 Claude Desktop 内置的 Claude Code 2.1.286 或更新版本（在本地 Code 会话运行 `/status` 查看）。原有 CLI 状态栏由一键脚本保留并组合；Desktop Mod 不会运行或覆盖已有状态栏脚本。

插件复用 CLI 配置中的网关 key 和 stats 地址。若网关地址是 `https://www.woodlandfield.top`，自动使用 `https://stats.woodlandfield.top`；其他 Magpie 部署需在 `~/.claude/crs-balance.env` 设置 `CRS_BACKEND=magpie` 和 `MAGPIE_STATS_URL`。只读查询自己的 stats 服务，不请求 Anthropic。

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

如果升级后找不到 `/crs-balance:statusline-repair`，请先刷新 marketplace，再更新插件并重启 Claude Code：

```bash
claude plugin marketplace update crs-tools
claude plugin update crs-balance@crs-tools --scope user
claude plugin update crs-desktop@crs-tools --scope user
```

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
