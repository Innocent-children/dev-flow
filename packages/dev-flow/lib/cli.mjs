import { createInterface } from "node:readline/promises";

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
  if (!OPERATIONS.includes(operation)) throw new CLIError(`unknown operation ${operation}`);
  const parsed = {
    operation,
    host: null,
    profiles: [],
    targetVersion: "latest",
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
  if (parsed.targetVersion !== "latest" && !semverPattern.test(parsed.targetVersion)) {
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
  if (parsed.downgradeToken && operation !== "upgrade") throw new CLIError("--confirm-downgrade requires upgrade");

  return Object.freeze({
    ...parsed,
    interactive: false,
    outputMode: parsed.json ? "json" : parsed.plain || noColor ? "plain" : "rich",
  });
}

export async function promptForRequest({ input = process.stdin, output = process.stdout, language = resolveLanguage(), environment = process.env } = {}) {
  const messages = messagesForLanguage(language);
  const terminal = createInterface({ input, output });
  try {
    output.write(`${messages.title}\n\n`);
    const homeChoices = [
      { label: messages.installCodex, host: "codex" },
      { label: messages.installDeepSeek, host: "deepseek" },
      { label: messages.installAll, host: "all" },
      { label: messages.manage, host: null },
    ];
    homeChoices.forEach((choice, index) => output.write(`${index + 1}. ${choice.label}\n`));
    const home = selectNumber(await terminal.question(messages.choose), homeChoices, "home");
    if (home.host !== null) {
      const profile = home.host === "codex" ? null : validateProfile((await terminal.question(messages.profilePrompt)).trim() || "web");
      const request = parseArguments([
        "install",
        "--host", home.host,
        ...(profile ? ["--profile", profile] : []),
      ], { isTTY: true, noColor: process.env.NO_COLOR !== undefined });
      return Object.freeze({ ...request, outputMode: selectInteractivePresentationMode(output, environment) });
    }

    output.write(`\n${messages.manage}\n`);
    OPERATIONS.forEach((operation, index) => output.write(`${index + 1}. ${messages.operations[operation]}\n`));
    const operation = selectNumber(await terminal.question(messages.operationPrompt), OPERATIONS, "operation");
    HOSTS.forEach((host, index) => output.write(`${index + 1}. ${messages.hosts[host]}\n`));
    const host = selectNumber(await terminal.question(messages.hostPrompt), HOSTS, "Host");
    const profile = host === "codex" ? null : validateProfile((await terminal.question(messages.profilePrompt)).trim() || "web");
    const request = parseArguments([
      operation,
      "--host", host,
      ...(profile ? ["--profile", profile] : []),
    ], { isTTY: true, noColor: process.env.NO_COLOR !== undefined });
    return Object.freeze({ ...request, outputMode: selectInteractivePresentationMode(output, environment) });
  } finally {
    terminal.close();
  }
}

export async function confirmPlan(plan, request, { input = process.stdin, output = process.stdout, language = resolveLanguage() } = {}) {
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
  const terminal = createInterface({ input, output });
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
    return /^(?:y(?:es)?|是)$/iu.test((await terminal.question(messages.continuePrompt)).trim());
  } finally {
    terminal.close();
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
