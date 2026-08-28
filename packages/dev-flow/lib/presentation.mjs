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
  continuePrompt: "Continue? [y/N] ",
  operations: Object.fromEntries([
    "status", "doctor", "install", "upgrade", "repair", "reinstall", "uninstall", "factory-reset",
  ].map((operation) => [operation, operation])),
  hosts: { codex: "codex", deepseek: "deepseek", all: "all" },
  statuses: Object.fromEntries([
    "ready", "absent", "partial", "incompatible", "conflicted", "unknown", "restart_required",
    "confirmation_required", "failed",
  ].map((status) => [status, status])),
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

function translateImpact(impact, language, messages) {
  if (language !== "zh-CN") return impact;
  const fixed = {
    "Read Host and Adapter state only": "仅读取 Host 和 Adapter 状态",
    "Remove every installed Adapter before shared data cleanup": "在清理共享数据前移除所有已安装的 Adapter",
    "Clear Dev Flow user configuration": "清理 Dev Flow 用户配置",
    "Clear current default Task data": "清理当前默认 Task 数据",
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
