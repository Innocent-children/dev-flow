import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { validateConfigurationFile } from "../lib/configuration.mjs";
import { diagnoseInstallation } from "../lib/diagnostics.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-config-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "config.json");
  const content = '{"claude":{"codebase_memory":true},"deepseek":{},"codex":{}}\n';
  await writeFile(path, content, { mode: 0o600 });
  const paths = await resolveManagerPaths({ homeDirectory: root, environment: {} });
  return { root, path, content, paths };
}

test("configuration diagnostics forward exact bytes to the selected Core without Host rules", async t => {
  const { root, path, content, paths } = await fixture(t);
  const preferences = { codex: { codebase_memory: false }, deepseek: { codebase_memory: false }, claude: { codebase_memory: true }, zcode: { codebase_memory: false } };
  const environment = { HOME: root };
  const result = await validateConfigurationFile(path, {
    environment, host: "claude", paths,
    resolveRuntime: async options => {
      assert.equal(options.requireData, false);
      assert.equal(options.host, "claude");
      assert.equal(options.homeDirectory, paths.homeDirectory);
      assert.equal(options.platform, paths.platform);
      assert.equal(options.arch, paths.arch);
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
  const { path, paths } = await fixture(t);
  await assert.rejects(validateConfigurationFile(path, {
    paths,
    resolveRuntime: async () => { throw new Error("no installed Adapter provides Core"); },
  }), /validation unavailable.*no installed Adapter/);
  await assert.rejects(validateConfigurationFile(path, {
    paths,
    resolveRuntime: async () => ({ runtimePath: "core" }),
    run: async () => {
      const error = new Error("exit 1");
      error.stdout = JSON.stringify({ ok: false, error: { code: "INVALID_CONFIGURATION", message: 'duplicate field "claude"' } });
      throw error;
    },
  }), /duplicate field "claude"/);
});

test("configuration diagnostics reject missing or invalid permission policies before invoking Core", async t => {
  const { path } = await fixture(t);
  for (const paths of [undefined, null, {}, { enforcePrivateModes: null }, { enforcePrivateModes: "false" }, { enforcePrivateModes: 0 }]) {
    await assert.rejects(validateConfigurationFile(path, {
      paths,
      resolveRuntime: async () => { assert.fail("invalid policy must not resolve Core"); },
      run: async () => { assert.fail("invalid policy must not invoke Core"); },
    }), /requires a boolean paths\.enforcePrivateModes policy/);
  }
});

test(`configuration diagnostics refuse public permissions with private-mode enforcement${process.platform === "win32" ? " (macOS policy simulated on Windows)" : ""}`, async t => {
  const { path, paths } = await fixture(t);
  await chmod(path, 0o644);
  await assert.rejects(validateConfigurationFile(path, {
    paths: { ...paths, enforcePrivateModes: true },
    resolveRuntime: async () => { assert.fail("unsafe permissions must not resolve Core"); },
    run: async () => { assert.fail("unsafe permissions must not invoke Core"); },
  }), /configuration permissions are unsafe/);
});

test("configuration diagnostics validate through a native Core subprocess", { timeout: 120000 }, async t => {
  const { root, path, paths } = await fixture(t);
  const runtimePath = join(root, process.platform === "win32" ? "taskbelay.exe" : "taskbelay");
  await promisify(execFile)("go", ["build", "-o", runtimePath, "./cmd/taskbelay"], {
    cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 120000,
  });
  const options = { paths, resolveRuntime: async () => ({ runtimePath }) };
  const result = await validateConfigurationFile(path, options);
  assert.equal(result.claude.codebase_memory, true);
  assert.equal(result.codex.codebase_memory, false);
  assert.equal(result.zcode.codebase_memory, false);
  await writeFile(path, '{"claude":{},"claude":{}}');
  await assert.rejects(validateConfigurationFile(path, options), /duplicate field "claude"/);
});

test("doctor delegates existing configuration and skips Core when no file exists", async () => {
  let calls = 0;
  const paths = Object.freeze({ platform: "win32", arch: "x64", enforcePrivateModes: false });
  const environment = {};
  const observed = { codex: null, deepseek: [], claude: null, zcode: null, resources: { configuration: { path: "/config.json", exists: true }, defaultData: { path: "/data", exists: false, label: "data" } } };
  const checks = await diagnoseInstallation(observed, { host: "claude", paths, environment, validateConfiguration: async (path, options) => {
    calls++;
    assert.equal(path, observed.resources.configuration.path);
    assert.equal(options.paths, paths);
    assert.equal(options.environment, environment);
    assert.equal(options.host, "claude");
    throw new Error("invalid field from Core");
  } });
  assert.equal(calls, 1);
  assert.equal(checks.find(c => c.name === "configuration").status, "failed");
  assert.match(checks.find(c => c.name === "configuration").message, /invalid field from Core/);
  observed.resources.configuration.exists = false;
  const missing = await diagnoseInstallation(observed, { host: "claude", validateConfiguration: async () => { throw new Error("must not run"); } });
  assert.equal(missing.find(c => c.name === "configuration").status, "passed");
});
