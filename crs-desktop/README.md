# CRS Balance for Claude Desktop

在 Claude Desktop 的本地 Code 会话中，于输入框上方显示现有 `crs-balance` 的 5h / 7d 用量和当前 key 的估算占比。保留其他 Mod 的界面，不接管终端 `statusLine`。

- 使用本机已安装的 `crs-balance@crs-tools`，复用其配置、认证、缓存和用量计算；本 Mod 不调用模型或 Anthropic API。
- 30 秒检查一次，完成一轮会话时也刷新。点击右侧“刷新”可绕过本机短期缓存，重新读取 stats 快照；不会触发 Anthropic 请求。暂时失败时保留最近成功读数，标记为缓存，最多保留 5 分钟；token 无效等由原插件直接显示。
- 只在桌面 Code 本地会话显示。新会话尚未启动或 Chat 页面不显示。
- 与 `crs-balance` 一起通过仓库根目录的一键脚本安装。需要先配置自己的网关地址和 key；桌面端使用已有 `crs-balance` 的配置。

验证：`node --test crs-desktop/test/desktop.test.mjs`；`claude plugin validate crs-desktop`。
