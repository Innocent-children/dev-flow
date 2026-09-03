import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";

export const DEFAULT_USER_CONFIGURATION = `${JSON.stringify({
  codex: { codebase_memory: false },
  deepseek: { codebase_memory: false },
}, null, 2)}\n`;

const MAX_CONFIGURATION_BYTES = 16 * 1024;
export const SETUP_NEXT_STEP = "Review and trust the Dev Flow hook with /hooks, then use $dev-flow-codex:dev-flow <task description> to assess the request";

export async function ensureUserConfiguration(paths) {
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

  await validateExistingConfiguration(configurationPath, enforcePrivateModes);
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
    `dev-flow-codex setup: ${result.status}`,
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
    "╭─ DEV FLOW · CODEX ─────────────────────────────────────────────╮",
    `│ \u001b[36mDEV FLOW · CODEX\u001b[0m`,
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

async function validateExistingConfiguration(path, enforcePrivateModes) {
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
  if (raw.length > MAX_CONFIGURATION_BYTES) {
    throw new Error(`user configuration ${JSON.stringify(path)}: exceeds 16 KiB`);
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch (error) {
    throw new Error(`user configuration ${JSON.stringify(path)}: invalid UTF-8`, { cause: error });
  }
  let value;
  try {
    assertNoDuplicateJSONMembers(text);
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`user configuration ${JSON.stringify(path)}: invalid JSON`, { cause: error });
  }
  assertClosedConfiguration(value, path);
}

function assertClosedConfiguration(value, path) {
  if (!isObject(value)) throw new Error(`user configuration ${JSON.stringify(path)}: top level must be an object`);
  for (const [host, preferences] of Object.entries(value)) {
    if (!new Set(["codex", "deepseek"]).has(host)) {
      throw new Error(`user configuration ${JSON.stringify(path)}: unknown top-level field ${JSON.stringify(host)}`);
    }
    if (!isObject(preferences)) {
      throw new Error(`user configuration ${JSON.stringify(path)}: field ${JSON.stringify(host)} must be an object`);
    }
    for (const [field, setting] of Object.entries(preferences)) {
      if (field !== "codebase_memory") {
        throw new Error(`user configuration ${JSON.stringify(path)}: unknown field ${JSON.stringify(`${host}.${field}`)}`);
      }
      if (typeof setting !== "boolean") {
        throw new Error(`user configuration ${JSON.stringify(path)}: field ${JSON.stringify(`${host}.codebase_memory`)} must be a boolean`);
      }
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertNoDuplicateJSONMembers(text) {
  let offset = 0;
  const skip = () => { while (/\s/u.test(text[offset] ?? "")) offset += 1; };
  const string = () => {
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      if (text[offset] === "\\") { offset += 2; continue; }
      if (text[offset] === '"') { offset += 1; return JSON.parse(text.slice(start, offset)); }
      offset += 1;
    }
    throw new Error("unterminated string");
  };
  const value = () => {
    skip();
    if (text[offset] === "{") return object();
    if (text[offset] === "[") return array();
    if (text[offset] === '"') { string(); return; }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(text.slice(offset));
    if (!match) throw new Error("invalid value");
    offset += match[0].length;
  };
  const object = () => {
    offset += 1; skip();
    const keys = new Set();
    if (text[offset] === "}") { offset += 1; return; }
    while (true) {
      skip();
      if (text[offset] !== '"') throw new Error("invalid object key");
      const key = string();
      if (keys.has(key)) throw new Error(`duplicate field ${key}`);
      keys.add(key); skip();
      if (text[offset] !== ":") throw new Error("missing colon");
      offset += 1; value(); skip();
      if (text[offset] === "}") { offset += 1; return; }
      if (text[offset] !== ",") throw new Error("missing comma");
      offset += 1;
    }
  };
  const array = () => {
    offset += 1; skip();
    if (text[offset] === "]") { offset += 1; return; }
    while (true) {
      value(); skip();
      if (text[offset] === "]") { offset += 1; return; }
      if (text[offset] !== ",") throw new Error("missing comma");
      offset += 1;
    }
  };
  value(); skip();
  if (offset !== text.length) throw new Error("trailing JSON");
}
