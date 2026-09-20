import { access, lstat, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

export async function resolveCommandInvocation(executable) {
  return Object.freeze({ executable, prefixArguments: Object.freeze([]) });
}

export async function findCommandPath(name, {
  environment = process.env,
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
  const extensions = [""];
  for (const base of bases) {
    for (const extension of extensions) {
      const candidate = `${base}${extension}`;
      if (await isRegularFile(candidate)) return candidate;
    }
  }
  throw commandNotFound(name, "command is not discoverable on PATH");
}

export async function commandResolvesToPackage(commandPath, expectedLauncherPath) {
  const [command, expected] = await Promise.all([realpath(commandPath), realpath(expectedLauncherPath)]);
  return command === expected;
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
