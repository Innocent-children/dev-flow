const chinese = {
  title: "Dev Flow 生命周期管理器",
  manage: "管理现有安装",
  choose: "请选择：",
  operationPrompt: "选择操作：",
  hostPrompt: "选择 Host：",
  profilePrompt: "DeepSeek Profile [web]：",
  installCodex: "安装 Codex",
  installDeepSeek: "安装 DeepSeek",
  installAll: "同时安装 Codex 和 DeepSeek",
  plan: "执行计划",
  next: "下一步",
  changed: "已变更",
  unchanged: "无变更",
  progress: {
    actionStart: "开始",
    actionComplete: "完成",
    steps: {
      "codex.install_package": "安装 Codex Adapter 全局 package",
      "codex.setup_registration": "配置 Codex marketplace、Plugin 和 MCP 注册",
      "codex.verify_ready": "回读并确认 Codex Adapter 已就绪",
      "deepseek.verify_artifact": "下载并校验 DeepSeek Adapter 制品",
      "deepseek.remove": "移除 DeepSeek Profile 中的旧 Adapter",
      "deepseek.add": "把 DeepSeek Adapter 加入目标 Profile",
      "deepseek.write_receipt": "写入并保存 DeepSeek Profile 安装记录",
    },
  },
  continuePrompt: "继续？[y/N] ",
  operations: {
    status: "状态",
    doctor: "诊断",
    install: "安装",
    upgrade: "升级",
    repair: "修复",
    reinstall: "重装",
    uninstall: "卸载",
    "factory-reset": "恢复出厂设置",
  },
  hosts: { codex: "Codex", deepseek: "DeepSeek", all: "全部" },
  statuses: {
    ready: "就绪",
    absent: "未安装",
    partial: "部分完成",
    incompatible: "不兼容",
    conflicted: "冲突",
    unknown: "未知",
    restart_required: "需要重启",
    confirmation_required: "等待确认",
    failed: "失败",
  },
  pet: {
    menuStart: "开启桌面宠物",
    menuStop: "关闭桌面宠物",
    started: "✓ 桌面宠物已开启",
    restored: "✓ 桌面宠物已在运行，窗口已恢复显示",
    stopped: "✓ 桌面宠物已关闭",
    invalidArguments: "参数无效；受支持的形式是 dev-flow pet start 和 dev-flow pet stop",
    unsupportedPlatform: "桌面宠物仅支持 Apple silicon 上的 macOS",
    applicationUnavailable: "当前统一入口包内没有可用的桌面宠物应用",
    installAdapterFirst: "未找到已安装的 Codex 或 DeepSeek Adapter；先运行 dev-flow install",
    coreCommandFailed: "Core 命令执行失败",
    serviceUnavailable: "本地 Control Center 服务不可用；运行 dev-flow webui start 后重试",
    serviceStartFailed: "本地 Control Center 服务启动失败",
    identityMismatch: "本地 Control Center 服务身份与所选 Core 不一致",
    incompatibleRuntime: "当前数据目录与所选 Core 不兼容",
    launchFailed: "桌面宠物启动失败",
    stopFailed: "桌面宠物关闭失败",
  },
};
const english = {
  title: "Dev Flow Lifecycle Manager",
  manage: "Manage existing installation",
  choose: "Choose: ",
  operationPrompt: "Operation: ",
  hostPrompt: "Host: ",
  profilePrompt: "DeepSeek Profile [web]: ",
  installCodex: "Install Codex",
  installDeepSeek: "Install DeepSeek",
  installAll: "Install Codex + DeepSeek",
  plan: "Plan",
  next: "Next step",
  changed: "Changed",
  unchanged: "No changes",
  progress: {
    actionStart: "Starting",
    actionComplete: "Completed",
    steps: {
      "codex.install_package": "Install the global Codex Adapter package",
      "codex.setup_registration": "Configure the Codex marketplace, Plugin, and MCP registration",
      "codex.verify_ready": "Read back and verify that the Codex Adapter is ready",
      "deepseek.verify_artifact": "Download and verify the DeepSeek Adapter artifact",
      "deepseek.remove": "Remove the previous Adapter from the DeepSeek Profile",
      "deepseek.add": "Add the DeepSeek Adapter to the target Profile",
      "deepseek.write_receipt": "Write and save the DeepSeek Profile installation receipt",
    },
  },
  continuePrompt: "Continue? [y/N] ",
  operations: Object.fromEntries([
    "status", "doctor", "install", "upgrade", "repair", "reinstall", "uninstall", "factory-reset",
  ].map((operation) => [operation, operation])),
  hosts: { codex: "codex", deepseek: "deepseek", all: "all" },
  statuses: Object.fromEntries([
    "ready", "absent", "partial", "incompatible", "conflicted", "unknown", "restart_required",
    "confirmation_required", "failed",
  ].map((status) => [status, status])),
  pet: {
    menuStart: "Start the desktop pet",
    menuStop: "Stop the desktop pet",
    started: "✓ Desktop pet started",
    restored: "✓ Desktop pet is already running; its window was restored",
    stopped: "✓ Desktop pet stopped",
    invalidArguments: "invalid arguments; the supported forms are dev-flow pet start and dev-flow pet stop",
    unsupportedPlatform: "the desktop pet supports macOS on Apple silicon only",
    applicationUnavailable: "this package does not provide a usable desktop pet application",
    installAdapterFirst: "no installed Codex or DeepSeek Adapter provides a Core runtime; run dev-flow install first",
    coreCommandFailed: "the Core command failed",
    serviceUnavailable: "the local Control Center service is unavailable; run dev-flow webui start and try again",
    serviceStartFailed: "the local Control Center service did not start",
    identityMismatch: "the local Control Center service identity differs from the selected Core",
    incompatibleRuntime: "the data directory is incompatible with the selected Core",
    launchFailed: "the desktop pet did not start",
    stopFailed: "the desktop pet did not stop",
  },
};

export function resolveLanguage(environment = process.env) {
  const locale = environment.LC_ALL || environment.LC_MESSAGES || environment.LANG || "";
  return /^zh(?:[_-]|$)/iu.test(locale) ? "zh-CN" : "en";
}

export function messagesForLanguage(language) {
  return language === "zh-CN" ? chinese : english;
}

export function renderResult(result, { mode = "plain", language = resolveLanguage() } = {}) {
  if (mode === "json") return `${JSON.stringify(result)}\n`;
  const messages = messagesForLanguage(language);
  if (["install", "reinstall"].includes(result.operation) && result.changed && result.status === "ready") {
    return renderInstallSuccess(result, { mode, language, messages });
  }
  const mark = result.status === "ready" || result.status === "absent" ? "✓" : "!";
  const lines = [
    mode === "rich" ? `◆ ${messages.title}` : messages.title,
    `${mark} ${messages.operations[result.operation] ?? result.operation}: ${messages.statuses[result.status] ?? result.status}`,
    `${result.changed ? messages.changed : messages.unchanged}`,
  ];
  for (const target of result.targets ?? []) {
    lines.push(`- ${messages.hosts[target.host] ?? target.host}${target.profile ? `/${target.profile}` : ""}: ${messages.statuses[target.state] ?? target.state}`);
  }
  if (result.next_step) lines.push(`${messages.next}: ${result.next_step}`);
  return `${lines.join("\n")}\n`;
}

export function selectInteractivePresentationMode(output, environment = process.env) {
  if (!output?.isTTY || Object.hasOwn(environment ?? {}, "NO_COLOR")) return "plain";
  if ((environment?.TERM ?? "").toLowerCase() === "dumb") return "plain";
  if (!Number.isInteger(output.columns) || output.columns < 80) return "plain";
  return "rich";
}

export function renderPlan(plan, { mode = "plain", language = resolveLanguage() } = {}) {
  if (mode === "json") return "";
  const messages = messagesForLanguage(language);
  const lines = [`${messages.plan} ${messages.operations[plan.operation] ?? plan.operation} (${plan.planId})`];
  for (const impact of plan.impacts) lines.push(`- ${translateImpact(impact, language, messages)}`);
  return `${lines.join("\n")}\n`;
}

export function renderProgress(event, { language = resolveLanguage() } = {}) {
  const messages = messagesForLanguage(language);
  if (event.type === "action_start" || event.type === "action_complete") {
    const state = event.type === "action_start" ? messages.progress.actionStart : messages.progress.actionComplete;
    return `${event.type === "action_start" ? "→" : "✓"} ${state}: ${actionLabel(event.action, messages)}\n`;
  }
  if (event.type === "step_complete") {
    return `  ✓ ${stepLabel(event.stepId, messages)}\n`;
  }
  throw new Error(`unsupported progress event ${event.type}`);
}

function actionLabel(action, messages) {
  const host = messages.hosts[action.host] ?? action.host;
  const profile = action.profile ? ` Profile ${action.profile}` : "";
  return `${messages.operations[action.operation] ?? action.operation} ${host}${profile}`;
}

function stepLabel(stepId, messages) {
  const normalized = stepId.replace(/^deepseek\.[^.]+\./u, "deepseek.");
  return messages.progress.steps[normalized] ?? stepId;
}

function translateImpact(impact, language, messages) {
  if (language !== "zh-CN") return impact;
  const fixed = {
    "Read Host and Adapter state only": "仅读取 Host 和 Adapter 状态",
    "Remove every installed Adapter before shared data cleanup": "在清理共享数据前移除所有已安装的 Adapter",
    "Clear Dev Flow user configuration": "清理 Dev Flow 用户配置",
    "Clear current default Task data": "清理当前默认 Task 数据",
    "Clear desktop pet records, preferences, and imported appearances": "清理桌面宠物记录、偏好与导入形象",
    "Clear the explicitly confirmed Task data directory": "清理已明确确认的 Task 数据目录",
    "Permanently remove confirmed data": "永久删除已确认的数据",
    "Move confirmed data to macOS Trash": "将已确认的数据移入 macOS 废纸篓",
    "Create fresh state and reinstall selected Adapters": "创建全新状态并重新安装所选 Adapter",
    "No installed Adapter or active Dev Flow data was found": "未发现已安装的 Adapter 或有效 Dev Flow 数据",
    "Preserve Dev Flow user configuration and Task data": "保留 Dev Flow 用户配置和 Task 数据",
  };
  if (fixed[impact]) return fixed[impact];
  const target = /^(status|doctor|install|upgrade|repair|reinstall|uninstall|factory-reset) (codex|deepseek)(?: Profile (.+)| Adapter)$/u.exec(impact);
  if (!target) return impact;
  const [, operation, host, profile] = target;
  return `${messages.operations[operation]} ${messages.hosts[host]}${profile ? ` Profile ${profile}` : " Adapter"}`;
}

function renderInstallSuccess(result, { mode, language, messages }) {
  const chinese = language === "zh-CN";
  const lines = [];
  if (mode === "rich") {
    lines.push(
      "██████╗ ███████╗██╗   ██╗    ███████╗██╗      ██████╗ ██╗    ██╗",
      "██╔══██╗██╔════╝██║   ██║    ██╔════╝██║     ██╔═══██╗██║    ██║",
      "██║  ██║█████╗  ██║   ██║    █████╗  ██║     ██║   ██║██║ █╗ ██║",
      "██║  ██║██╔══╝  ╚██╗ ██╔╝    ██╔══╝  ██║     ██║   ██║██║███╗██║",
      "██████╔╝███████╗ ╚████╔╝     ██║     ███████╗╚██████╔╝╚███╔███╔╝",
      "",
    );
  }
  lines.push(chinese ? "✓ Dev Flow 安装完成" : "✓ Dev Flow installation complete");
  for (const target of result.targets ?? []) {
    if (target.state !== "ready" && target.state !== "restart_required") continue;
    const host = messages.hosts[target.host] ?? target.host;
    const profile = target.profile ? ` Profile ${target.profile}` : "";
    const version = target.package_version ? ` ${target.package_version}` : "";
    const state = messages.statuses[target.state] ?? target.state;
    lines.push(`✓ ${host}${profile}${version} · ${state}`);
  }
  const codex = result.targets?.some((target) => target.host === "codex" && ["ready", "restart_required"].includes(target.state));
  const deepseek = result.targets?.some((target) => target.host === "deepseek" && ["ready", "restart_required"].includes(target.state));
  lines.push("", chinese ? "接下来" : "Next steps");
  if (codex) {
    lines.push(chinese ? "1. 在 Codex 对话中输入" : "1. Enter in a Codex conversation", "   $dev-flow-codex:dev-flow <task description>");
  }
  if (deepseek) {
    const index = codex ? 2 : 1;
    lines.push(chinese ? `${index}. 在 DeepSeek 对话中输入` : `${index}. Enter in a DeepSeek conversation`, "   /dev-flow <task description>");
  }
  lines.push("", chinese ? "Control Center" : "Control Center", "  dev-flow webui start", "  dev-flow webui open", "  dev-flow webui status", "  dev-flow webui stop");
  lines.push("", chinese ? "安装管理" : "Installation management", "  dev-flow status", "  dev-flow doctor", "  dev-flow upgrade");
  return `${lines.join("\n")}\n`;
}
