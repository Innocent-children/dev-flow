// Maintainer helpers for executing and comparing complete Skill examples.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { examples, filesBelow } from "./resources.mjs";

export async function readExamples(root, kind) {
  const values = [];
  for (const path of await filesBelow(root)) {
    if (!path.endsWith(".md")) continue;
    for (const example of examples(await readFile(path, "utf8"), kind)) {
      values.push({ kind, tool: example.operation, name: example.name, input: example.value, path });
    }
  }
  return values;
}

export function exampleNormalizer(replacements = []) {
  const aliases = new Map();
  const counts = new Map();
  function text(value) {
    for (const [actual, example] of replacements.toSorted((a, b) => b[0].length - a[0].length)) {
      value = value.replaceAll(actual, example);
    }
    value = value.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, "2026-09-10T00:00:00.000Z");
    return value.replace(/\b(?:[0-9a-f]{64}|[0-9a-f]{40}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g, (value) => {
      if (aliases.has(value)) return aliases.get(value);
      const size = value.length;
      const next = (counts.get(size) ?? 0) + 1;
      counts.set(size, next);
      const alias = size === 36
        ? `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`
        : next.toString(16).padStart(size, "0");
      aliases.set(value, alias);
      return alias;
    });
  }
  function walk(value) {
    if (typeof value === "string") return text(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, walk(value[key])]));
    }
    return value;
  }
  return walk;
}

export async function verifySuccessExample(example, input, output, normalize) {
  const file = join(dirname(example.path), "successes", `${example.kind}-${example.tool}-${example.name}.md`);
  const request = normalize(input);
  const response = normalize(output);
  if (process.env.DEV_FLOW_UPDATE_SKILL_EXAMPLES === "1") {
    await mkdir(dirname(file), { recursive: true });
    const implementation = example.kind === "host"
      ? "`packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`"
      : "`packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`";
    await writeFile(file, `# ${example.tool}: ${example.name}\n\nImplementation: ${implementation}.\n\nComplete result from the adapter implementation, executed in a temporary Git fixture.\nHost session creation, handoff completion and Core terminal reads are supplied test observations,\nnot live Host calls. Paths, generated identities, digests and timestamps use stable example values;\nall fields and their references are retained and compared.\n\nResolved request:\n\n<!-- example:resolved-${example.kind} ${example.tool} ${example.name} -->\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\`\n\nComplete response:\n\n<!-- example:${example.kind}-success ${example.tool} ${example.name} -->\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\`\n`);
    return;
  }
  const source = await readFile(file, "utf8");
  const blocks = [...source.matchAll(/```json\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 2, `${file}: requires a request and response`);
  assert.deepEqual(request, JSON.parse(blocks[0][1]), `${file}: resolved request changed`);
  assert.deepEqual(response, JSON.parse(blocks[1][1]), `${file}: actual response changed`);
  const guide = await readFile(example.path, "utf8");
  const link = relative(dirname(example.path), file).replaceAll("\\", "/");
  assert.ok(guide.includes(`](${link})`), `${example.path}: missing response link`);
}
