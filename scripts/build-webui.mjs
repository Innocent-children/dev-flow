#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { execPortableCommand } from "../packages/dev-flow/lib/command.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = resolve(dirname(scriptPath), "..");
const normalizedExtensions = new Set([".css", ".html", ".json", ".svg", ".ts", ".tsx"]);

export async function buildWebUI({
  repositoryRoot = defaultRepositoryRoot,
  environment = process.env,
  run = runCommand,
} = {}) {
  const root = resolve(repositoryRoot);
  const buildEnvironment = {
    ...environment,
    LC_ALL: "C",
    SOURCE_DATE_EPOCH: environment.SOURCE_DATE_EPOCH || "0",
    TZ: "UTC",
  };
  if (!(await isDirectory(join(root, "packages", "webui", "node_modules")))) {
    await run("pnpm", ["--dir", root, "install", "--frozen-lockfile", "--ignore-scripts"], {
      cwd: root,
      environment: buildEnvironment,
    });
  }
  const restoreSources = await normalizeWebUISources(join(root, "packages", "webui"));
  try {
    await run("pnpm", ["--dir", root, "--filter", "@dev-flow/webui", "run", "build"], {
      cwd: root,
      environment: buildEnvironment,
    });
  } finally {
    await restoreSources();
  }
}

async function normalizeWebUISources(root) {
  const originals = [];
  const restore = async () => {
    for (const { path, contents } of originals.reverse()) await writeFile(path, contents);
  };
  try {
    await visit(root);
  } catch (error) {
    await restore();
    throw error;
  }
  return restore;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile() || !normalizedExtensions.has(extname(entry.name))) continue;
      const contents = await readFile(path);
      const normalized = Buffer.from(contents.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
      if (normalized.equals(contents)) continue;
      originals.push({ path, contents });
      await writeFile(path, normalized);
    }
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function runCommand(executable, arguments_, { cwd, environment }) {
  try {
    return await execPortableCommand(executable, arguments_, {
      cwd,
      env: environment,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
      shell: false,
      windowsHide: true,
    });
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(`${executable} ${arguments_.join(" ")} failed${detail ? `: ${detail}` : ""}`, { cause: error });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildWebUI().catch((error) => {
    process.stderr.write(`build-webui: ${error.message}\n`);
    process.exitCode = 1;
  });
}
