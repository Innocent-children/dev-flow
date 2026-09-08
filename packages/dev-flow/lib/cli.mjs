import { createTerminalSession } from "./terminal.mjs";

import { supportsDesktopPet } from "./platform.mjs";
import { messagesForLanguage, resolveLanguage, selectInteractivePresentationMode } from "./presentation.mjs";

export const OPERATIONS = Object.freeze([
  "status",
  "doctor",
  "install",
  "upgrade",
  "repair",
  "reinstall",
  "uninstall",
  "factory-reset",
]);
export const HOSTS = Object.freeze(["codex", "deepseek", "all"]);

const booleanOptions = new Map([
  ["--all-known-profiles", "allKnownProfiles"],
  ["--adopt", "adopt"],
  ["--reinstall", "reinstallAfterReset"],
  ["--permanent", "permanent"],
  ["--yes", "yes"],
  ["--plain", "plain"],
  ["--json", "json"],
]);
const valueOptions = new Map([
  ["--host", "host"],
  ["--profile", "profiles"],
  ["--version", "targetVersion"],
  ["--confirm-reset", "confirmationToken"],
  ["--confirm-permanent", "permanentToken"],
  ["--confirm-downgrade", "downgradeToken"],
  ["--confirm-explicit-data", "confirmedExplicitData"],
]);
const repeatableOptions = new Set(["profiles", "confirmedExplicitData"]);
const mutationOperations = new Set(OPERATIONS.filter((operation) => !["status", "doctor"].includes(operation)));
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function parseArguments(arguments_, {
  isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  noColor = process.env.NO_COLOR !== undefined,
} = {}) {
  if (!Array.isArray(arguments_) || arguments_.some((value) => typeof value !== "string" || value.includes("\0"))) {
    throw new CLIError("arguments must be closed strings");
  }
  if (arguments_.length === 0) {
    if (!isTTY) throw new CLIError("an operation is required outside a TTY");
    return Object.freeze({ interactive: true, outputMode: noColor ? "plain" : "rich" });
  }

  const [operation, ...rest] = arguments_;
  if (OPERATIONS.includes(operation) && rest.length === 1 && ["--help", "-h"].includes(rest[0])) return Object.freeze({ help: operation });
  if (!OPERATIONS.includes(operation)) throw new CLIError(`unknown operation ${operation}`);
  const parsed = {
    operation,
    host: null,
    profiles: [],
    targetVersion: null,
    allKnownProfiles: false,
    adopt: false,
    reinstallAfterReset: false,
    permanent: false,
    yes: false,
    plain: false,
    json: false,
    confirmationToken: null,
    permanentToken: null,
    downgradeToken: null,
    confirmedExplicitData: [],
  };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (booleanOptions.has(option)) {
      const field = booleanOptions.get(option);
      if (seen.has(field)) throw new CLIError(`duplicate option ${option}`);
      seen.add(field);
      parsed[field] = true;
      continue;
    }
    if (!valueOptions.has(option)) throw new CLIError(`unknown option ${option}`);
    const field = valueOptions.get(option);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) throw new CLIError(`${option} requires a value`);
    index += 1;
    if (!repeatableOptions.has(field) && seen.has(field)) throw new CLIError(`duplicate option ${option}`);
    seen.add(field);
    if (repeatableOptions.has(field)) parsed[field].push(value);
    else parsed[field] = value;
  }

  if (parsed.host === null) {
    if (mutationOperations.has(operation) && !isTTY) throw new CLIError("--host is required for non-interactive mutation");
    parsed.host = "all";
  }
  if (!HOSTS.includes(parsed.host)) throw new CLIError(`invalid Host ${parsed.host}`);
  parsed.profiles = [...new Set(parsed.profiles.map(validateProfile))];
  parsed.confirmedExplicitData = [...new Set(parsed.confirmedExplicitData)];
  if ((parsed.host === "deepseek" || parsed.host === "all") && parsed.profiles.length === 0 && !parsed.allKnownProfiles) {
    parsed.profiles = ["web"];
  }
  if (parsed.host === "codex" && (parsed.profiles.length > 0 || parsed.allKnownProfiles || parsed.adopt)) {
    throw new CLIError("DeepSeek Profile options require --host deepseek or all");
  }
  if (parsed.targetVersion !== null && parsed.targetVersion !== "latest" && !semverPattern.test(parsed.targetVersion)) {
    throw new CLIError("--version must equal latest or a stable semantic version");
  }
  if (operation !== "factory-reset" && (parsed.reinstallAfterReset || parsed.permanent || parsed.confirmationToken || parsed.permanentToken || parsed.confirmedExplicitData.length > 0)) {
    throw new CLIError("reset options require factory-reset");
  }
  if (!["install", "upgrade", "repair", "reinstall"].includes(operation) && seen.has("targetVersion")) {
    throw new CLIError("--version is not supported for this operation");
  }
  if (parsed.adopt && !["install", "repair"].includes(operation)) {
    throw new CLIError("--adopt requires install or repair");
  }
  if (parsed.json && parsed.plain) throw new CLIError("--json and --plain conflict");
  if (parsed.permanentToken && !parsed.permanent) throw new CLIError("--confirm-permanent requires --permanent");
  if (parsed.downgradeToken && !["install", "upgrade", "repair", "reinstall"].includes(operation)) throw new CLIError("--confirm-downgrade requires a versioned operation");

  return Object.freeze({
    ...parsed,
    interactive: false,
    outputMode: parsed.json ? "json" : parsed.plain || noColor || !isTTY ? "plain" : "rich",
  });
}

export async function promptForRequest({
  input = process.stdin, output = process.stdout, language = resolveLanguage(),
  environment = process.env, platform = process.platform, arch = process.arch,
  observation = null, session = null,
} = {}) {
  const messages = messagesForLanguage(language);
  const terminal = session ?? createTerminalSession(input, output);
  const zh = language === "zh-CN";
  const choose = async (prompt, entries, back = false) => {
    entries.forEach((entry, index) => output.write(`  ${index + 1}. ${entry.label ?? entry}\n`));
    output.write(`  0. ${zh ? back ? "返回" : "退出" : back ? "Back" : "Exit"}\n`);
    while (true) {
      const value = await terminal.question(prompt);
      if (value === null || ["0", "q", "quit"].includes(value.trim().toLowerCase())) return null;
      try { return selectNumber(value, entries, "menu"); }
      catch { output.write(zh ? "请输入列表中的数字，或输入 0。\n" : "Enter a listed number, or 0.\n"); }
    }
  };
  try {
    while (true) {
      const title = selectInteractivePresentationMode(output, environment) === "rich" ? `\u001b[1;36m${messages.title}\u001b[0m` : messages.title;
      output.write(`\n${title}\n${"─".repeat(Math.max(12, Math.min(48, (output.columns ?? 38) - 2)))}\n`);
      for (const target of observation?.targets ?? []) {
        output.write(`  ${target.host}${target.profile ? `/${target.profile}` : ""} · ${messages.statuses[target.state] ?? target.state}${target.package_version ? ` · ${target.package_version}` : ""}\n`);
        for (const issue of target.issues ?? []) output.write(`    ! ${issue.message}\n`);
      }
      if (observation?.next_step) output.write(`  ${messages.next}: ${observation.next_step}\n`);
      output.write("\n");
      const home = await choose(messages.choose, [
        { label: messages.installCodex, host: "codex" },
        { label: messages.installDeepSeek, host: "deepseek" },
        { label: messages.installAll, host: "all" },
        { label: messages.manage, host: null },
        ...(supportsDesktopPet(platform, arch) ? [
          { label: messages.pet.menuStart, pet: "start" }, { label: messages.pet.menuStop, pet: "stop" },
        ] : []),
        { label: zh ? "打开 Control Center" : "Open Control Center", webui: "start" },
      ]);
      if (!home) return { cancelled: true };
      if (home.pet || home.webui) return home.pet ? { pet: home.pet } : { webui: home.webui };
      let operation = "install";
      let host = home.host;
      if (host === null) {
        output.write(`\n${messages.manage}\n`);
        const selected = await choose(messages.operationPrompt, OPERATIONS.map(value => ({ value, label: `${messages.operations[value]} — ${operationDescription(value, language)}` })), true);
        if (!selected) continue;
        operation = selected.value;
        if (operation === "factory-reset") host = "all";
        else {
          const selectedHost = await choose(messages.hostPrompt, HOSTS.map(value => ({ value, label: messages.hosts[value] })), true);
          if (!selectedHost) continue;
          host = selectedHost.value;
        }
      }
      const options = [operation, "--host", host];
      if (operation === "factory-reset") options.push("--all-known-profiles");
      else if (host !== "codex") {
        const profiles = observation?.targets?.filter(t => t.host === "deepseek").map(t => t.profile) ?? [];
        if (profiles.length) output.write(`${zh ? "已知 Profile" : "Known Profiles"}: ${profiles.join(", ")}\n`);
        const prompt = zh ? "DeepSeek Profile [web]，输入 * 选择全部，0 返回：" : "DeepSeek Profile [web], * for all, 0 to go back: ";
        let profile;
        while (true) {
          const value = await terminal.question(prompt);
          if (value === null || value.trim() === "0") break;
          if (value.trim() === "*") { profile = "*"; break; }
          try { profile = validateProfile(value.trim() || "web"); break; }
          catch { output.write(zh ? "Profile 只可使用字母、数字、点、下划线和连字符。\n" : "Use letters, numbers, dots, underscores and hyphens for a Profile.\n"); }
        }
        if (!profile) continue;
        if (profile === "*") options.push("--all-known-profiles");
        else options.push("--profile", profile);
      }
      return Object.freeze({ ...parseArguments(options, { isTTY: true }), fromMenu: true,
        outputMode: selectInteractivePresentationMode(output, environment) });
    }
  } finally { if (!session) terminal.close(); }
}

export function operationDescription(operation, language = "en") {
  const descriptions = language === "zh-CN" ? {
    status: "查看安装和版本", doctor: "检查故障并给出处理命令", install: "补齐 Adapter，保留已有版本",
    upgrade: "更新 Adapter 到目标版本", repair: "修复当前版本", reinstall: "重新安装当前版本",
    uninstall: "移除 Adapter，保留用户数据", "factory-reset": "移除全部 Adapter 并清理已确认数据",
  } : {
    status: "Show installation and versions", doctor: "Diagnose failures and suggest commands", install: "Complete installation, keep existing versions",
    upgrade: "Update Adapters to the target version", repair: "Repair the current version", reinstall: "Reinstall the current version",
    uninstall: "Remove Adapters, keep user data", "factory-reset": "Remove all Adapters and confirmed data",
  };
  return descriptions[operation];
}

export function renderHelp(operation = null, language = "en") {
  const zh = language === "zh-CN";
  const operations = operation ? [operation] : OPERATIONS;
  return ["Dev Flow", "", ...operations.map(value => `  dev-flow ${value} — ${operationDescription(value, language)}`),
    "", "  dev-flow webui start|open|status|stop [--plain|--json]", "  dev-flow pet start|stop", "  dev-flow version", "",
    zh ? "生命周期参数：" : "Lifecycle options:",
    "  --host codex|deepseek|all", "  --profile <name>  --all-known-profiles",
    "  --version latest|<x.y.z>  --confirm-downgrade <token>",
    "  --yes  --plain  --json  --help", "  --adopt (install/repair, DeepSeek)",
    "  factory-reset: --confirm-reset <token> [--reinstall]",
    "                 --confirm-explicit-data <absolute-path>",
    "                 --permanent --confirm-permanent <token>", "",
    zh ? "install/repair/reinstall 默认保留已安装版本；upgrade 默认 latest。缺失项使用 latest。" : "install/repair/reinstall keep installed versions; upgrade defaults to latest. Missing installations use latest.",
    zh ? "非交互修改必须指定 --host；--yes 只确认普通维护。JSON 模式不询问，返回确认命令。" : "Non-interactive changes require --host; --yes confirms ordinary maintenance only. JSON never prompts and returns confirmation commands.",
    zh ? "--all-known-profiles 用于全部受管 Profile；安装时没有已知 Profile 则使用 web。" : "--all-known-profiles selects managed Profiles; install uses web when none exist.",
    zh ? "维护对象是 Dev Flow Adapter；更新公共入口：npm install -g @imotong/dev-flow@latest" : "Commands maintain Dev Flow Adapters; update this launcher with npm install -g @imotong/dev-flow@latest",
    "", "  dev-flow install --host codex --yes", "  dev-flow repair --host deepseek --profile web --yes", "  dev-flow factory-reset --host all --all-known-profiles", "",
  ].join("\n");
}

export async function confirmPlan(plan, request, { input = process.stdin, output = process.stdout, language = resolveLanguage(), session = null } = {}) {
  const messages = messagesForLanguage(language);
  if (plan.confirmationClass === "none") return true;
  if (plan.confirmationClass === "mutation" && request.yes) return true;
  if (plan.confirmationClass === "downgrade" && request.downgradeToken === plan.downgradeToken) return true;
  if (plan.confirmationClass === "reset" || plan.confirmationClass === "permanent_reset") {
    if (request.confirmationToken === plan.confirmationToken &&
        (plan.confirmationClass !== "permanent_reset" || request.permanentToken === plan.permanentToken)) return true;
    if (!input.isTTY) return false;
  } else if (!input.isTTY) {
    return false;
  }
  if (request.outputMode === "json") return false;
  const terminal = session ?? createTerminalSession(input, output);
  try {
    if (plan.confirmationClass === "reset" || plan.confirmationClass === "permanent_reset") {
      const token = await terminal.question(language === "zh-CN" ? `输入 ${plan.confirmationToken} 确认恢复出厂设置：` : `Type ${plan.confirmationToken} to confirm reset: `);
      if (token !== plan.confirmationToken) return false;
      if (plan.confirmationClass === "permanent_reset") {
        return await terminal.question(language === "zh-CN" ? `输入 ${plan.permanentToken} 确认永久删除：` : `Type ${plan.permanentToken} to confirm permanent removal: `) === plan.permanentToken;
      }
      return true;
    }
    if (plan.confirmationClass === "downgrade") {
      return await terminal.question(language === "zh-CN" ? `输入 ${plan.downgradeToken} 确认降级：` : `Type ${plan.downgradeToken} to confirm downgrade: `) === plan.downgradeToken;
    }
    return /^(?:y(?:es)?|是)$/iu.test((await terminal.question(messages.continuePrompt) ?? "").trim());
  } finally {
    if (!session) terminal.close();
  }
}

export class CLIError extends Error {
  constructor(message) {
    super(message);
    this.name = "CLIError";
    this.exitCode = 2;
  }
}

function validateProfile(value) {
  if (!value || value === "." || value === ".." || /[\\/\0]/u.test(value) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value)) {
    throw new CLIError(`invalid DeepSeek Profile ${JSON.stringify(value)}`);
  }
  return value;
}

function selectNumber(value, entries, label) {
  const index = Number(value) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= entries.length) throw new CLIError(`invalid ${label} selection`);
  return entries[index];
}
