import { execFile as execFileCallback } from "node:child_process";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import { basename, delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";

const WINDOWS_NATIVE_EXTENSIONS = Object.freeze([".exe", ".com"]);
const WINDOWS_SCRIPT_EXTENSIONS = Object.freeze([".ps1", ".cmd", ".bat"]);

export async function execPortableCommand(executable, arguments_, options = {}) {
  const invocation = await resolveCommandInvocation(executable, {
    environment: options.env ?? process.env,
  });
  return await execFileWithClosedInput(invocation.executable, [...invocation.prefixArguments, ...arguments_], options);
}

export async function findCommandPath(name, {
  environment = process.env,
  platform = process.platform,
} = {}) {
  if (typeof name !== "string" || name === "" || name.includes("\0")) {
    throw commandNotFound(String(name), "command name must be a non-empty closed string");
  }
  const pathDirectories = String(environmentValue(environment, "PATH") ?? "")
    .split(delimiter)
    .map((entry) => entry.replace(/^"|"$/gu, ""))
    .filter(Boolean);
  const explicitPath = isAbsolute(name) || dirname(name) !== ".";
  const bases = explicitPath ? [resolve(name)] : pathDirectories.map((directory) => join(directory, name));
  const extensions = platform === "win32" && extname(name) === ""
    ? [...WINDOWS_NATIVE_EXTENSIONS, ...WINDOWS_SCRIPT_EXTENSIONS, ""]
    : [""];
  for (const base of bases) {
    for (const extension of extensions) {
      const candidate = `${base}${extension}`;
      if (await isRegularFile(candidate)) return candidate;
    }
  }
  throw commandNotFound(name, "command is not discoverable on PATH");
}

export async function commandResolvesToPackage(commandPath, expectedLauncherPath, {
  platform = process.platform,
  packageName,
} = {}) {
  const [command, expected] = await Promise.all([realpath(commandPath), realpath(expectedLauncherPath)]);
  if (command === expected) return true;
  if (platform !== "win32") return false;
  const installedLauncher = join(
    dirname(commandPath),
    "node_modules",
    packageName,
    "bin",
    basename(expectedLauncherPath),
  );
  return await realpath(installedLauncher).catch(() => null) === expected;
}

async function resolveCommandInvocation(executable, { environment }) {
  if (process.platform !== "win32") {
    return Object.freeze({ executable, prefixArguments: Object.freeze([]) });
  }
  const commandPath = await findCommandPath(executable, { environment, platform: "win32" });
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
