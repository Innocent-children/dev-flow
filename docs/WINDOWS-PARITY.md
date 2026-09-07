# Windows 功能对齐方案

[中文](WINDOWS-PARITY.md) | [English](WINDOWS-PARITY_en.md)

## Problem

现有 Windows Core 与 Host 入口可运行，但没有 macOS 已交付的桌面任务宠物。Windows 用户无法在桌面选择任务、查看保存状态、导入形象或使用动画与交互。

## Current approach

Windows 用户需要手工打开 WebUI；macOS 用户可以从宠物和菜单栏进入所选任务。

## Available data

使用当前 Core runtime 状态、WebUI 的 system/status、分页 tasks 和 task detail，以及现有默认形象与动画清单。宠物设置只保存显示选择，不保存流程游标。

## Behavior rules

Core 继续唯一决定任务状态。Windows 使用独立 Electron 桌面进程，提供透明置顶窗口和系统托盘；macOS 保留 Swift/AppKit。断连显示最后记录，恢复、切换任务和唤醒不重放历史完成提示。任务提示优先于休闲动作；隐藏和睡眠停止请求与动画。单实例启动恢复已有窗口，停止按产品目录和 Core 身份限定。

## Expected result

Windows 10/11 x64 获得任务选择、状态气泡、WebUI 跳转、托盘/右键菜单、拖动位置保存、隐藏恢复、动画与休闲开关、六档缩放、PNG/SVG 静态/原生动画包和 Codex PNG/WebP 九行图集导入、形象切换及独立启停。Windows 本地开发包包含桌面运行时，运行不依赖开发机工具链。

## Risks and impact

错误状态展示会误导用户，因此每轮验证同一 Core 与数据目录身份，且不推断任务完成。素材校验失败保留原选择和已安装素材。渲染器不持有 Node 权限，不读取任意文件、不访问远程内容。Electron 仅属于 Windows 桌面包，不进入 Core 或 macOS 依赖。

## Acceptance checks

在本机 Windows 11 Intel x64 上检查显示映射、动画时序、素材校验/导入、设置原子保存、受限本地接口、构建与解包、真实桌面窗口截图、启动复用与停止，以及现有 Windows 入口回归。仅执行 Windows 检查，不运行或交叉构建 macOS；Windows 10 与 AMD 实机不可用时明确记录。真实 Core/WebUI 和人工构造状态的检查分别报告。

## Non-goals

不修改流程图、转移、Schema、Core 状态决策；不新增远程服务、账号、发布或自动 Git 操作；不为 Windows 32 位、ARM64、Server 或特殊系统扩展支持。

## 产品评估

显示当前保存状态与入口帮助恢复长任务，依据来自 Core 记录，减少寻找任务的操作。Codex/DeepSeek 仍使用原接口，桌面不增加任务处理步骤。当前对齐解决 Windows 已缺失的任务查看与交互能力；完整 Host 会话验证与桌面验证分别记录。

实现和验证结果见[适配报告](WINDOWS-ADAPTATION.md)。

## 统一入口交付约束

Windows 开发分发包通过 package.json 的 devFlowLocalPackages 明确绑定两个 Adapter 安装包的路径、版本与 SHA256。统一入口按该声明安装；声明损坏或摘要不符时停止，不转向其他来源。普通发布包没有该声明，继续使用原有 npm 版本选择。

用户先以 npm 安装统一入口，再使用 dev-flow install、upgrade、repair、reinstall 和 pet start/stop。所有 Adapter 注册与桌面程序更新由该入口执行。本地包允许同版本替换源代码；Codex 先通过自身 remove 验证并移除有 receipt 的注册，再安装与 setup。Windows 维护逻辑根据完整可执行路径、命令和进程创建时间识别 Core，停止被维护的 MCP/WebUI 实例后替换文件；Mac 保留原有进程替换行为。

Windows GUI 通过系统 Start-Process 启动，并用每次启动唯一的确认记录返回结果，不让长期运行的宠物占用调用终端的输出句柄。桌面副本按本地包更新，设置与形象保留。
