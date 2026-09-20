import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
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

test("Claude platform policies load from an independent package directory", async t => {
  const packageDirectory = await mkdtemp(join(tmpdir(), "dev-flow-claude-platform-"));
  t.after(() => rm(packageDirectory, { recursive: true, force: true }));
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const platformFiles = ["lib/platform.mjs", "lib/platform/macos/policies.mjs", "lib/platform/windows/policies.mjs"];
  for (const relative of platformFiles) {
    assert.ok(pkg.files.includes(relative), relative);
    const target = join(packageDirectory, relative);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(new URL(relative, root), target);
  }
  const { platformPolicy } = await import(pathToFileURL(join(packageDirectory, "lib/platform.mjs")).href);
  assert.equal(platformPolicy("win32", "x64").runtimeExecutable, "dev-flow.exe");
  assert.equal(platformPolicy("darwin", "arm64").runtimeExecutable, "dev-flow");
  assert.throws(() => platformPolicy("win32", "arm64"), /Unsupported Claude Adapter platform/);
  assert.throws(() => platformPolicy("linux", "x64"), /Unsupported Claude Adapter platform/);
});
