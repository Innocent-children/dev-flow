import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { validateConfigurationFile } from "../lib/configuration.mjs";
import { diagnoseInstallation } from "../lib/diagnostics.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-config-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "config.json");
  const content = '{"claude":{"codebase_memory":true},"deepseek":{},"codex":{}}\n';
  await writeFile(path, content, { mode: 0o600 });
  return { root, path, content };
}

test("configuration diagnostics forward exact bytes to the selected Core without Host rules", async t => {
  const { root, path, content } = await fixture(t);
  const preferences = { codex: { codebase_memory: false }, deepseek: { codebase_memory: false }, claude: { codebase_memory: true } };
  const environment = { HOME: root };
  const result = await validateConfigurationFile(path, {
    environment, host: "claude", paths: { homeDirectory: root, enforcePrivateModes: true },
    resolveRuntime: async options => {
      assert.equal(options.requireData, false);
      assert.equal(options.host, "claude");
      assert.equal(options.homeDirectory, root);
      assert.equal(options.environment, environment);
      return { runtimePath: join(root, "core") };
    },
    run: async (executable, args, options) => {
      assert.equal(executable, join(root, "core"));
      assert.deepEqual(args, ["config", "validate"]);
      assert.equal(options.input.toString(), content);
      assert.equal(options.env, environment);
      return { stdout: JSON.stringify({ ok: true, result: preferences }) };
    },
  });
  assert.deepEqual(result, preferences);
  assert.equal(await readFile(path, "utf8"), content);
});

test("configuration diagnostics preserve Core refusal and report missing Core honestly", async t => {
  const { path } = await fixture(t);
  await assert.rejects(validateConfigurationFile(path, {
    resolveRuntime: async () => { throw new Error("no installed Adapter provides Core"); },
  }), /validation unavailable.*no installed Adapter/);
  await assert.rejects(validateConfigurationFile(path, {
    resolveRuntime: async () => ({ runtimePath: "core" }),
    run: async () => {
      const error = new Error("exit 1");
      error.stdout = JSON.stringify({ ok: false, error: { code: "INVALID_CONFIGURATION", message: 'duplicate field "claude"' } });
      throw error;
    },
  }), /duplicate field "claude"/);
});

test("configuration diagnostics validate through a native Core subprocess", { timeout: 120000 }, async t => {
  const { root, path } = await fixture(t);
  const runtimePath = join(root, process.platform === "win32" ? "dev-flow.exe" : "dev-flow");
  await promisify(execFile)("go", ["build", "-o", runtimePath, "./cmd/dev-flow"], {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 120000,
  });
  const options = { resolveRuntime: async () => ({ runtimePath }) };
  const result = await validateConfigurationFile(path, options);
  assert.equal(result.claude.codebase_memory, true);
  assert.equal(result.codex.codebase_memory, false);
  await writeFile(path, '{"claude":{},"claude":{}}');
  await assert.rejects(validateConfigurationFile(path, options), /duplicate field "claude"/);
});

test("doctor delegates existing configuration and skips Core when no file exists", async () => {
  let calls = 0;
  const observed = { codex: null, deepseek: [], claude: null, resources: { configuration: { path: "/config.json", exists: true }, defaultData: { path: "/data", exists: false, label: "data" } } };
  const checks = await diagnoseInstallation(observed, { host: "claude", validateConfiguration: async () => { calls++; throw new Error("invalid field from Core"); } });
  assert.equal(calls, 1);
  assert.equal(checks.find(c => c.name === "configuration").status, "failed");
  assert.match(checks.find(c => c.name === "configuration").message, /invalid field from Core/);
  observed.resources.configuration.exists = false;
  const missing = await diagnoseInstallation(observed, { host: "claude", validateConfiguration: async () => { throw new Error("must not run"); } });
  assert.equal(missing.find(c => c.name === "configuration").status, "passed");
});
