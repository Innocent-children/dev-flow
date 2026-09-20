import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
const root = new URL("../", import.meta.url);
test("Claude plugin paths stay inside the independently cached package", async () => {
  const manifest = JSON.parse(await readFile(new URL(".claude-plugin/plugin.json", root), "utf8"));
  assert.equal(manifest.name, "dev-flow-claude");
  for (const file of [manifest.hooks, manifest.mcpServers]) { assert.equal(file.includes(".."), false); await access(new URL(file, root)); }
  const mcp = JSON.parse(await readFile(new URL(".mcp.json", root), "utf8"));
  assert.equal(mcp.mcpServers["dev-flow"].command, "node");
  assert.ok(mcp.mcpServers["dev-flow"].args[0].startsWith("${CLAUDE_PLUGIN_ROOT}/"));
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.version, manifest.version);
  assert.ok(pkg.files.includes("lib/worktree-snapshot.mjs"));
  assert.ok(pkg.files.includes("plugin/skills/dev-flow/references/tool-results.md"));
});
