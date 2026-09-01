import { execFile as execFileCallback } from "node:child_process";
import { access, lstat, readFile } from "node:fs/promises";
import { delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";

const WINDOWS_NATIVE_EXTENSIONS = Object.freeze([".exe", ".com"]);
const WINDOWS_SCRIPT_EXTENSIONS = Object.freeze([".ps1", ".cmd", ".bat"]);

export async function execPortableCommand(executable, arguments_, options = {}) {
  const invocation = await resolveCommandInvocation(executable, options.env ?? process.env);
  return await execFileWithClosedInput(invocation.executable, [...invocation.prefixArguments, ...arguments_], options);
}

async function resolveCommandInvocation(executable, environment) {
  if (process.platform !== "win32") {
    return Object.freeze({ executable, prefixArguments: Object.freeze([]) });
  }
  const commandPath = await findWindowsCommand(executable, environment);
  const extension = extname(commandPath).toLowerCase();
  if ([".mjs", ".js", ".cjs"].includes(extension) || extension === "" && await isNodeScript(commandPath)) {
    return Object.freeze({ executable: process.execPath, prefixArguments: Object.freeze([commandPath]) });
  }
  if (WINDOWS_NATIVE_EXTENSIONS.includes(extension) || extension === "") {
    return Object.freeze({ executable: commandPath, prefixArguments: Object.freeze([]) });
  }
  const scriptPath = extension === ".ps1"
    ? commandPath
    : `${commandPath.slice(0, -extension.length)}.ps1`;
  if (!(await isRegularFile(scriptPath))) {
    throw commandNotFound(executable, "Windows command shim has no matching PowerShell launcher");
  }
  const systemRoot = environmentValue(environment, "SYSTEMROOT");
  const powershell = systemRoot
    ? join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
  return Object.freeze({
    executable: powershell,
    prefixArguments: Object.freeze([
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ]),
  });
}

async function findWindowsCommand(name, environment) {
  if (typeof name !== "string" || name === "" || name.includes("\0")) {
    throw commandNotFound(String(name), "command name is invalid");
  }
  const explicitPath = isAbsolute(name) || dirname(name) !== ".";
  const directories = explicitPath
    ? [""]
    : String(environmentValue(environment, "PATH") ?? "")
      .split(delimiter)
      .map((entry) => entry.replace(/^"|"$/gu, ""))
      .filter(Boolean);
  const baseName = explicitPath ? resolve(name) : name;
  const extensions = extname(name) === ""
    ? [...WINDOWS_NATIVE_EXTENSIONS, ...WINDOWS_SCRIPT_EXTENSIONS, ""]
    : [""];
  for (const directory of directories) {
    const base = explicitPath ? baseName : join(directory, baseName);
    for (const extension of extensions) {
      const candidate = `${base}${extension}`;
      if (await isRegularFile(candidate)) return candidate;
    }
  }
  throw commandNotFound(name, "command is not discoverable on PATH");
}

async function isRegularFile(path) {
  try {
    const info = await lstat(path);
    await access(path);
    return info.isFile() || info.isSymbolicLink();
  } catch {
    return false;
  }
}

async function isNodeScript(path) {
  try {
    const prefix = (await readFile(path)).subarray(0, 128).toString("utf8");
    return /^#!.*\bnode(?:\.exe)?(?:\s|$)/u.test(prefix.split(/\r?\n/u, 1)[0]);
  } catch {
    return false;
  }
}

function execFileWithClosedInput(executable, arguments_, options) {
  return new Promise((resolvePromise, reject) => {
    const child = execFileCallback(executable, arguments_, options, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolvePromise({ stdout, stderr });
    });
    child.stdin?.end();
  });
}

function commandNotFound(executable, detail) {
  const error = new Error(`${executable}: ${detail}`);
  error.code = "ENOENT";
  return error;
}

function environmentValue(environment, name) {
  if (Object.hasOwn(environment ?? {}, name)) return environment[name];
  const expected = name.toUpperCase();
  for (const [key, value] of Object.entries(environment ?? {})) {
    if (key.toUpperCase() === expected) return value;
  }
  return undefined;
}
