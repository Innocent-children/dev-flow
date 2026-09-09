import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export async function filesBelow(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(path);
  }
  return files.sort();
}

export function examples(markdown, kind) {
  return [...markdown.replace(/\r\n?/gu, "\n").matchAll(/<!-- example:([a-z-]+) ([a-z_-]+) ([a-z_-]+) -->\n```json\n([\s\S]*?)\n```/gu)]
    .filter((match) => match[1] === kind)
    .map((match) => ({ operation: match[2], name: match[3], value: JSON.parse(match[4]) }));
}

function headingAnchors(markdown) {
  return new Set([...markdown.matchAll(/^#{1,6} (.+)$/gmu)].map((match) => match[1]
    .replace(/`/gu, "").toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replace(/ /gu, "-")));
}


export async function assertSkillResources({ skillRoot, packageRoot, repositoryRoot }) {
  const skillPath = join(skillRoot, "SKILL.md");
  const markdownFiles = (await filesBelow(skillRoot)).filter((path) => path.endsWith(".md"));
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const texts = new Map(await Promise.all(markdownFiles.map(async (path) => [path, await readFile(path, "utf8")])));
  const edges = new Map();
  for (const [path, markdown] of texts) {
    const packaged = relative(packageRoot, path).split("\\").join("/");
    assert.ok(manifest.files.includes(packaged), packaged);
    const links = [];
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      if (/^https?:/u.test(match[1])) continue;
      const [destination, fragment] = match[1].split("#");
      const target = destination ? resolve(dirname(path), destination) : path;
      assert.ok(texts.has(target), `${path}: unresolved packaged reference ${match[1]}`);
      if (fragment) assert.ok(headingAnchors(texts.get(target)).has(fragment), `${path}: unresolved anchor ${match[1]}`);
      links.push(target);
    }
    edges.set(path, links);
    const sourcePaths = [...markdown.matchAll(/`((?:internal|packages|cmd)\/[A-Za-z0-9_./-]+\.(?:go|mjs|json|yaml))`/gu)];
    assert.ok(sourcePaths.length > 0, `${path}: no implementation reference`);
    for (const match of sourcePaths) {
      assert.ok((await stat(join(repositoryRoot, match[1]))).isFile(), match[1]);
    }
    for (const match of markdown.matchAll(/`((?:internal|packages|cmd)\/[A-Za-z0-9_./-]+\.(?:go|mjs))` — `([^`]+)`/gu)) {
      const source = await readFile(join(repositoryRoot, match[1]), "utf8");
      for (const symbol of match[2].split(", ")) {
        assert.ok(new RegExp(`\\b${symbol}\\b`, "u").test(source), `${path}: ${match[1]} has no ${symbol}`);
      }
    }
  }
  const visited = new Set();
  const pending = [skillPath];
  while (pending.length) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    pending.push(...edges.get(path));
  }
  assert.deepEqual([...visited].sort(), markdownFiles);
}
