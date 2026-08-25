const chinese = {
  title: "Dev Flow 生命周期管理器",
  next: "下一步",
  changed: "已变更",
  unchanged: "无变更",
};
const english = {
  title: "Dev Flow Lifecycle Manager",
  next: "Next step",
  changed: "Changed",
  unchanged: "No changes",
};

export function resolveLanguage(environment = process.env) {
  const locale = environment.LC_ALL || environment.LC_MESSAGES || environment.LANG || "";
  return /^zh(?:[_-]|$)/iu.test(locale) ? "zh-CN" : "en";
}

export function renderResult(result, { mode = "plain", language = resolveLanguage() } = {}) {
  if (mode === "json") return `${JSON.stringify(result)}\n`;
  const messages = language === "zh-CN" ? chinese : english;
  const mark = result.status === "ready" || result.status === "absent" ? "✓" : "!";
  const lines = [
    mode === "rich" ? `◆ ${messages.title}` : messages.title,
    `${mark} ${result.operation}: ${result.status}`,
    `${result.changed ? messages.changed : messages.unchanged}`,
  ];
  for (const target of result.targets ?? []) {
    lines.push(`- ${target.host}${target.profile ? `/${target.profile}` : ""}: ${target.state}`);
  }
  if (result.next_step) lines.push(`${messages.next}: ${result.next_step}`);
  return `${lines.join("\n")}\n`;
}

export function renderPlan(plan, { mode = "plain" } = {}) {
  if (mode === "json") return "";
  const lines = [`Plan ${plan.operation} (${plan.planId})`];
  for (const impact of plan.impacts) lines.push(`- ${impact}`);
  return `${lines.join("\n")}\n`;
}
