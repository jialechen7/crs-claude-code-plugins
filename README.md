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

更多配置见 [crs-balance/README.md](crs-balance/README.md)。
