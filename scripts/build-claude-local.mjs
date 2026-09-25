#!/usr/bin/env node
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCoreRuntimes } from "./build-core-runtimes.mjs";
import { stageAndPack } from "./taskbelay-local.mjs";
import { execPortableCommand } from "../packages/taskbelay/lib/command.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function buildClaude({ outputRoot, run = (exe, args, options) => execPortableCommand(exe, args, { ...options, env: options.environment, encoding: "utf8", windowsHide: true }) }) {
  if (!isAbsolute(outputRoot)) throw new Error("Output directory must be absolute");
  await mkdir(outputRoot, { recursive: true });
  const temporary = await mkdtemp(join(tmpdir(), "claude-build-"));
  const report = await buildCoreRuntimes({ repositoryRoot: root, outputRoot: join(temporary, "runtime"), run });
  const artifacts = new Map(Object.values(report.runtimes).map(value => [value.relativePath, value]));
  return await stageAndPack("claude", { root, stageRoot: join(temporary, "stage"), outputRoot, coreArtifacts: artifacts, run });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== "--output") throw new Error("Usage: node scripts/build-claude-local.mjs --output ABSOLUTE_DIRECTORY");
  process.stdout.write(JSON.stringify(await buildClaude({ outputRoot: process.argv[3] })) + "\n");
}
