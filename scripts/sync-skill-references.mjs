#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const skillDirectories = Object.freeze({ codex: "packages/codex/plugin/skills/dev-flow", deepseek: "packages/deepseek/skills/dev-flow" });

async function referenceFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await referenceFiles(join(directory, entry.name), path));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

// Build owns Host substitutions and packaged copies; Core owns the described contracts.
export async function sharedSkillReferences({ root = repositoryRoot, host } = {}) {
  if (!Object.hasOwn(skillDirectories, host)) throw new Error("Skill host must be codex or deepseek");
  const sourceRoot = join(root, "skills/dev-flow/core");
  const references = new Map();
  for (const path of await referenceFiles(sourceRoot)) {
    const source = `skills/dev-flow/core/${path}`;
    const content = (await readFile(join(sourceRoot, path), "utf8"))
      .replace(/\r\n?/gu, "\n").replaceAll("{{host}}", host);
    if (/\{\{[^}]+\}\}/u.test(content)) throw new Error(`Unknown Skill substitution in ${source}`);
    references.set(`references/${path}`, `<!-- Generated from ${source}; edit the shared source and run node scripts/sync-skill-references.mjs. -->\n\n${content.trimEnd()}\n`);
  }
  return references;
}

export async function writeSharedSkillReferences({ root = repositoryRoot, host, destination } = {}) {
  const references = await sharedSkillReferences({ root, host });
  const skillRoot = destination ?? join(root, skillDirectories[host]);
  for (const [path, content] of references) {
    const target = join(skillRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export async function checkSharedSkillReferences({ root = repositoryRoot } = {}) {
  const mismatches = [];
  for (const host of Object.keys(skillDirectories)) {
    for (const [path, content] of await sharedSkillReferences({ root, host })) {
      const target = join(root, skillDirectories[host], path);
      let actual;
      try { actual = await readFile(target, "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (actual?.replace(/\r\n?/gu, "\n") !== content) mismatches.push(`${skillDirectories[host]}/${path}`);
    }
  }
  if (mismatches.length) throw new Error(`Skill copies differ from shared sources; run node scripts/sync-skill-references.mjs:\n${mismatches.join("\n")}`);
}

async function main(args) {
  if (args.length === 1 && args[0] === "--check") return await checkSharedSkillReferences();
  if (args.length === 0) {
    for (const host of Object.keys(skillDirectories)) await writeSharedSkillReferences({ host });
    return;
  }
  if (args.length === 4 && args[0] === "--host" && args[2] === "--output") {
    return await writeSharedSkillReferences({ host: args[1], destination: resolve(args[3]) });
  }
  throw new Error("Usage: node scripts/sync-skill-references.mjs [--check | --host codex|deepseek --output SKILL_DIRECTORY]");
}
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
