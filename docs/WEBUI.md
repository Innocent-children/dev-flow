# Dev Flow 本地 WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

Dev Flow Control Center 是嵌入 Go Core 的本机单用户界面。它展示共享数据目录中的 Task 概览、筛选列表、
详情、时间线、流程图、Action、Recovery、Blocker 和生命周期操作。浏览器不保存第二份流程游标；每次读取和
写入都经由 Core 的 Application、Workflow、Recovery 与 Store 边界。

界面完整支持简体中文和英文。首次打开时按浏览器有序语言偏好选择：最先命中的中文 locale 使用中文，
最先命中的英文 locale 使用英文，其它情况使用英文。shell 中的语言开关可随时切换；手工选择只保存在
当前浏览器的 local site storage，清除站点数据后重新跟随系统语言。Core ID、枚举、路径、事实和原始错误不翻译。
中文界面使用自然的产品语言描述任务、筛选、操作和系统状态，不把“权威边界”“runtime ownership”等内部
架构术语直译成页面标题。输入框、下拉框、日期控件和按钮使用统一高度、边框、焦点与对齐规则。
“开始任务”同时承载新建和继续已有任务；普通表单只填写仓库路径，主仓库默认标识和附加仓库标识由系统
生成。任务列表的当前阶段选项来自 Core 当前流程定义。所有选择控件使用 WebUI 自有、支持键盘操作的
combobox/listbox，不调用浏览器原生下拉弹层。

视觉层复用内嵌的 Dev Flow 蓝紫渐变小尺寸标志，以深色品牌导航区分工作区，用分层卡片组织
任务、Action、流程图与运行状态，并保留绿色、琥珀色和红色表达各自的语义状态。桌面布局展示完整导航
文字和并列信息；窄屏收拢为图标导航、单列卡片与可横向查看的密集内容，页面入口、主要操作、焦点样式和
键盘交互保持一致。界面只使用系统字体，不请求外部字体、CDN 或品牌资源服务。

概览和任务列表同时显示主仓库的 `repository_group_id` 短标识与实际 `worktree_path`；任务详情为
Scope 中每个 repository 显示自己的组标识和路径。linked worktree 共享组标识但路径不同，因此用户
可以看出同一逻辑 Git 仓库中的多个独立 Task。该信息只从 Task snapshot 投影，不增加持久化状态。

## 启动与复用

先让 `DEV_FLOW_DATA_DIR` 指向一个已存在的本机目录，再使用携带 Core 的任一维护中 Host package：

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
dev-flow webui status
dev-flow webui open
dev-flow webui stop
```

`start` 默认打开浏览器；`--no-open` 只启动进程。所有命令支持 `--plain` 或 `--json`。服务只绑定
`tcp4 127.0.0.1` 的系统分配端口。mode `0600` 的 runtime receipt 记录 PID、进程启动身份、data-root
digest 和 loopback URL；另一 Host 携带的兼容 Core 会复用该实例，而不是创建 Host 专属进程或数据。
公共 `dev-flow webui start` 在默认数据目录缺失时以 mode `0700` 创建它；`open/status/stop/reset` 不创建
目录。设置 `DEV_FLOW_DATA_DIR` 后，该显式目录必须预先存在、canonical 且不经过符号链接。

## 状态与本地保护

`status` 区分 `ready`、`read_only`、`reset_required`、`incompatible` 和 `unavailable`。页面写操作要求
精确 Origin 和当前进程生成的随机 session 值，并始终携带当前 Task revision。页面轮询失败或 revision
变化时会失效旧表单。该边界用于本机误请求与陈旧页面保护，不是账号认证，也不允许远程监听。

## 旧数据 reset

旧 Schema 或启用前 Task 数据采用 `reject-and-reset`：普通启动零写入返回 `reset_required`。reset 永远不在
浏览器中执行：

```bash
dev-flow webui reset
dev-flow webui reset --confirm <当前计划返回的 TOKEN>
```

第一条命令只展示 canonical database 与现有 SQLite sidecar 的精确目标。确认 token 绑定这些目标；确认时
Core 先获得数据库独占访问并重新核对目标。锁失败、token 不匹配或目标变化都以零删除停止。成功后只删除
确认的 Task 数据并创建当前空 Schema；Host packages、registrations、用户配置和无关文件保持不变。

## 制品边界

React/TypeScript/Vite 只参与源码构建。入口 HTML、JavaScript、CSS、SVG 和 manifest 都嵌入 Core binary；
运行时不需要 Node server、CDN、外部字体、遥测或独立 WebUI package。公开稳定 package 是否已经携带本能力，
以[项目状态](PROJECT-STATUS.md)和[支持矩阵](SUPPORT-MATRIX.md)为准。
