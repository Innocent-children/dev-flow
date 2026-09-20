import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { operations } from "../bin/dev-flow-zcode.mjs";

const root = new URL("../", import.meta.url);

test("native plugin, marketplace, MCP and process Hook share a self-contained package", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const plugin = JSON.parse(await readFile(new URL(".zcode-plugin/plugin.json", root), "utf8"));
  const market = JSON.parse(await readFile(new URL("marketplace.json", root), "utf8"));
  const mcp = JSON.parse(await readFile(new URL(".mcp.json", root), "utf8"));
  const hooks = JSON.parse(await readFile(new URL("hooks/hooks.json", root), "utf8"));
  assert.equal(plugin.name, pkg.name);
  assert.equal(plugin.version, pkg.version);
  assert.equal(market.plugins[0].version, pkg.version);
  assert.equal(market.plugins[0].source, "./");
  assert.equal(Object.hasOwn(plugin, "hooks"), false, "standard hooks must be discovered exactly once");
  assert.deepEqual(mcp.mcpServers["dev-flow"].args, ["${ZCODE_PLUGIN_ROOT}/bin/dev-flow-zcode.mjs", "mcp"]);
  const group = hooks.hooks.PreToolUse[0];
  assert.equal(group.matcher, "Write|Edit");
  assert.equal(group.hooks[0].type, "process");
  assert.equal(group.hooks[0].command, "node");
  assert.deepEqual(group.hooks[0].args, ["${ZCODE_PLUGIN_ROOT}/bin/dev-flow-zcode.mjs", "hook", "pre-tool-use"]);
  for (const file of pkg.files) {
    assert.equal(file.includes(".."), false);
    if (file === "LICENSE" || file.startsWith("runtime/")) continue; // Staging supplies these from the release/build inputs.
    await access(new URL(file, root));
  }
  assert.ok(pkg.files.includes("runtime/win32-x64/dev-flow.exe"));
  assert.ok(pkg.files.includes("runtime/darwin-arm64/dev-flow"));
  assert.ok(pkg.files.includes("skills/dev-flow/references/successes/dev_flow_open_task-create.md"));
  assert.ok(pkg.files.includes("lib/worktree-snapshot.mjs"));
  assert.ok(operations.includes("open"));
  assert.equal(operations.includes("launch"), false);
  assert.equal(operations.includes("record-session"), false);
});

test("platform policies resolve from an independent package without another Host installation", async t => {
  const directory = await mkdtemp(join(tmpdir(), "zcode-platform-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  for (const file of ["lib/platform.mjs", "lib/platform/macos/policies.mjs", "lib/platform/windows/policies.mjs"]) {
    assert.ok(pkg.files.includes(file));
    const target = join(directory, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(new URL(file, root), target);
  }
  const { platformPolicy } = await import(pathToFileURL(join(directory, "lib/platform.mjs")).href);
  assert.equal(platformPolicy("win32", "x64").runtimeExecutable, "dev-flow.exe");
  assert.equal(platformPolicy("darwin", "arm64").runtimeExecutable, "dev-flow");
  assert.throws(() => platformPolicy("win32", "arm64"), /Unsupported ZCode/);
  assert.throws(() => platformPolicy("linux", "x64"), /Unsupported ZCode/);
});
