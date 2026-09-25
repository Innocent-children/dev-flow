import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";

import { execPortableCommand } from "./command.mjs";

export const DEFAULT_USER_CONFIGURATION = "{}\n";

export const SETUP_NEXT_STEP = "Review and trust the TaskBelay hook with /hooks, then use $taskbelay-codex:taskbelay <task description> to assess the request";

export async function ensureUserConfiguration(paths, { environment = process.env } = {}) {
  const { configurationDirectory, configurationPath, enforcePrivateModes = true } = paths ?? {};
  if (typeof configurationDirectory !== "string" || typeof configurationPath !== "string") {
    throw new Error("user configuration path is unavailable");
  }

  await ensureConfigurationDirectory(configurationDirectory, enforcePrivateModes);
  try {
    await writeFile(configurationPath, DEFAULT_USER_CONFIGURATION, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    if (enforcePrivateModes) await chmod(configurationPath, 0o600);
    return Object.freeze({
      configurationPath,
      fileChange: Object.freeze({ path: configurationPath, change: "created" }),
    });
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw new Error(`user configuration ${JSON.stringify(configurationPath)}: create failed`, { cause: error });
    }
  }

  await validateExistingConfiguration(configurationPath, enforcePrivateModes, paths.runtimePath, environment);
  return Object.freeze({ configurationPath, fileChange: null });
}

export function buildSetupSuccessResult(registration, configuration, receiptPath) {
  const fileChanges = [
    configuration?.fileChange,
    ...(registration?.fileChanges ?? []),
  ].filter(Boolean).map((entry) => Object.freeze({ path: entry.path, change: entry.change }));
  return Object.freeze({
    operation: "setup",
    status: registration.status,
    changed: fileChanges.length > 0,
    receipt_path: receiptPath,
    configuration_path: configuration.configurationPath,
    file_changes: Object.freeze(fileChanges),
    next_step: SETUP_NEXT_STEP,
  });
}

export function renderSetupPlain(result, language = "en") {
  const chinese = language === "zh-CN";
  const lines = [
    `taskbelay-codex setup: ${result.status}`,
    `${chinese ? "配置" : "configuration"}: ${result.configuration_path}`,
  ];
  if (result.file_changes.length === 0) {
    lines.push(chinese ? "文件变化: 无" : "file changes: none");
  } else {
    for (const entry of result.file_changes) {
      lines.push(`${entry.change}: ${entry.path}`);
    }
  }
  lines.push(`${chinese ? "下一步" : "next"}: ${result.next_step}`);
  return `${lines.join("\n")}\n`;
}

export function resolveSetupLanguage(environment = process.env) {
  const locale = [environment?.LC_ALL, environment?.LC_MESSAGES, environment?.LANG]
    .find((value) => typeof value === "string" && value.trim() !== "") ?? "";
  return /^(?:zh[-_](?:cn|sg|hans))(?:[.@_-]|$)/iu.test(locale) ? "zh-CN" : "en";
}

export function selectSetupPresentationMode(stdout, environment = process.env) {
  if (!stdout?.isTTY) return "plain";
  if (Object.hasOwn(environment ?? {}, "NO_COLOR")) return "plain";
  if ((environment?.TERM ?? "").toLowerCase() === "dumb") return "plain";
  if (!Number.isInteger(stdout.columns) || stdout.columns < 80) return "plain";
  return "rich";
}

export function renderSetup(result, {
  language = "en",
  mode = "plain",
} = {}) {
  if (mode !== "rich") return renderSetupPlain(result, language);
  if (result.status === "already-installed") return renderSetupPlain(result, language);
  const chinese = language === "zh-CN";
  const changes = result.file_changes.map((entry) =>
    `│ ${entry.change.padEnd(7)} ${entry.path}`
  );
  const lines = [
    "╭─ TASKBELAY · CODEX ─────────────────────────────────────────────╮",
    `│ \u001b[36mTASKBELAY · CODEX\u001b[0m`,
    `│ \u001b[32m✓ ${chinese ? "设置完成，Codex 已就绪" : "Setup complete. Codex is ready."}\u001b[0m`,
    `│ ${chinese ? "配置" : "Config"}  ${result.configuration_path}`,
    ...(changes.length === 0 ? [`│ ${chinese ? "文件变化  无" : "Changes  none"}`] : changes),
    `│ ${chinese ? "下一步" : "Next"}  ${result.next_step}`,
    "╰─────────────────────────────────────────────────────────────────╯",
  ];
  return `${lines.join("\n")}\n`;
}

async function ensureConfigurationDirectory(path, enforcePrivateModes) {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error("user configuration directory must be a regular directory");
    }
    if (enforcePrivateModes && (info.mode & 0o022) !== 0) {
      throw new Error("user configuration directory permissions are unsafe");
    }
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (enforcePrivateModes) await chmod(path, 0o700);
}

async function validateExistingConfiguration(path, enforcePrivateModes, runtimePath, environment) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    throw new Error(`user configuration ${JSON.stringify(path)}: read failed`, { cause: error });
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`user configuration ${JSON.stringify(path)}: must be a regular non-symbolic-link file`);
  }
  if (enforcePrivateModes && (info.mode & 0o077) !== 0) {
    throw new Error(`user configuration ${JSON.stringify(path)}: permissions are unsafe`);
  }
  let raw;
  try {
    raw = await readFile(path);
  } catch (error) {
    throw new Error(`user configuration ${JSON.stringify(path)}: read failed`, { cause: error });
  }
  let result;
  try {
    result = await execPortableCommand(runtimePath, ["config", "validate"], {
      env: environment, input: raw, encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true,
    });
  } catch (error) {
    if (!error.stdout) throw new Error(`user configuration ${JSON.stringify(path)}: Core validation unavailable`, { cause: error });
    result = error;
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`user configuration ${JSON.stringify(path)}: invalid Core validation response`, { cause: error });
  }
  if (report?.ok === false && typeof report.error?.message === "string") {
    throw new Error(`user configuration ${JSON.stringify(path)}: ${report.error.message}`);
  }
  if (result instanceof Error || report?.ok !== true || report.result === null || typeof report.result !== "object" || Array.isArray(report.result)) {
    throw new Error(`user configuration ${JSON.stringify(path)}: invalid Core validation response`);
  }
}
