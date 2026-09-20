#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const hosts = ["codex", "claude"];
export const hostCommandFiles = Object.freeze([
  "command.mjs",
  "platform/windows/command.mjs",
  "platform/macos/command.mjs",
]);

async function generatedCommand(root, path) {
  const source = (await readFile(join(root, "packages", "host-command", path), "utf8")).replace(/\r\n?/gu, "\n");
  return `// Generated from packages/host-command/${path}; edit the shared source.\n${source}`;
}

export async function writeHostCommands({ root = repositoryRoot, destination }) {
  for (const path of hostCommandFiles) {
    const content = await generatedCommand(root, path);
    const target = join(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export async function checkHostCommands({ root = repositoryRoot } = {}) {
  for (const path of hostCommandFiles) {
    const expected = await generatedCommand(root, path);
    for (const host of hosts) {
      const target = join(root, "packages", host, "lib", path);
      if ((await readFile(target, "utf8")).replace(/\r\n?/gu, "\n") !== expected) {
        throw new Error(`packages/${host}/lib/${path} differs from its shared source; run node scripts/sync-host-commands.mjs`);
      }
    }
  }
}

async function main(args) {
  if (args.length === 1 && args[0] === "--check") return checkHostCommands();
  if (args.length === 2 && args[0] === "--output" && isAbsolute(args[1])) {
    return writeHostCommands({ destination: args[1] });
  }
  if (args.length !== 0) {
    throw new Error("usage: sync-host-commands.mjs [--check | --output ABSOLUTE_LIB_DIRECTORY]");
  }
  for (const host of hosts) {
    await writeHostCommands({ destination: join(repositoryRoot, "packages", host, "lib") });
  }
}

if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => "") === await realpath(scriptPath)) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`sync-host-commands: ${error.message}\n`);
    process.exitCode = 1;
  });
}
