# crs-claude-code-plugins

Claude Code 插件 marketplace，目前包含：

- `crs-balance`：查看 CRS 上游 Claude 账号 5h / 7d 使用量，并可集成到 Claude Code statusLine。

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/jialechen7/crs-claude-code-plugins/main/install.sh | bash
```

安装脚本会完成：

- 添加 `crs-tools` marketplace
- 安装 `crs-balance@crs-tools`
- 创建 `~/.claude/crs-balance.env` 配置模板
- 创建稳定 wrapper `~/.claude/crs-statusline.sh`
- 自动写入 `~/.claude/settings.json` 的 `statusLine`

填好配置后重启 Claude Code：

```bash
vim ~/.claude/crs-balance.env
```

也可以手动安装：

```bash
claude plugin marketplace add https://github.com/jialechen7/crs-claude-code-plugins.git
claude plugin install crs-balance@crs-tools --scope user
```

已安装用户升级后，如果 statusLine 被其他插件覆盖，在 Claude Code 中运行：

```text
/crs-balance:statusline-repair
```

## 使用

Claude Code 中可调用：

```text
/crs-balance:balance
```

statusLine 配置如下；一键安装脚本会自动写入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "/Users/your_name/.claude/crs-statusline.sh"
  }
}
```

配置文件 `~/.claude/crs-balance.env`：

```bash
export CRS_BASE_URL=https://250924.xyz
export CRS_ADMIN_USER=admin
export CRS_ADMIN_PASS='your_password'
export CRS_ACCOUNT_NAME='your_account_name'
```

`crs-balance` 会直接读取这份文件；不需要把账号和密码再写到 `~/.zshrc`。

更多配置见 [crs-balance/README.md](crs-balance/README.md)。

## 与其他 statusLine 插件共存

Claude Code 的 `settings.json` 里 `statusLine` 字段全局唯一,装多个 statusLine 插件会互相覆盖。本插件采用**包装而非覆盖**策略:

- 安装时如果检测到 `statusLine.command` 已经被别的插件占用(例如 `claude-hud`),会把那条命令保存到 `~/.claude/crs-statusline.upstream`,然后把 `statusLine` 指向本插件 wrapper。
- 运行时本插件 wrapper 会先用同一份 stdin 跑 upstream 命令,再 append 自己的输出,两段内容用换行拼接显示。
- 如果之后其他插件的 setup(如 `/claude-hud:setup`)再次踹掉了本插件的 wrapper,运行 `/crs-balance:statusline-repair` 或重新跑一次一键安装脚本即可恢复。repair 会把当前非 CRS 的 `statusLine.command` 更新到 upstream,再把 `statusLine` 指回本插件 wrapper。

如果想撤掉接管关系,删掉 `~/.claude/crs-statusline.upstream` 即可。
