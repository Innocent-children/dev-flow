import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { permissionPolicy as codexPermissions, runtimeDescriptor as codexRuntime } from "../packages/codex/lib/platform.mjs";
import { permissionPolicy as deepseekPermissions, runtimeDescriptor as deepseekRuntime } from "../packages/deepseek/lib/platform.mjs";
import { permissionPolicy as managerPermissions, runtimeDescriptor as managerRuntime } from "../packages/dev-flow/lib/platform.mjs";
import { buildCoreRuntimes, CORE_RUNTIME_TARGETS } from "./build-core-runtimes.mjs";

const runFile = promisify(execFile);

test("package platform implementations match the runtime target catalog", () => {
  for (const target of CORE_RUNTIME_TARGETS) {
    const platform = target.runtimeKey.split("-")[0];
    const arch = target.runtimeKey.split("-")[1];
    for (const [selectRuntime, selectPermissions] of [
      [codexRuntime, codexPermissions],
      [deepseekRuntime, deepseekPermissions],
      [managerRuntime, managerPermissions],
    ]) {
      const runtime = selectRuntime(platform, arch);
      const permissions = selectPermissions(platform, arch);
      assert.equal(runtime.runtimeKey, target.runtimeKey);
      assert.equal(runtime.runtimeDirectory, target.runtimeKey);
      assert.equal(runtime.runtimeExecutable, target.executable);
      assert.equal(permissions.requireExecutableMode, target.requireExecutableMode);
    }
  }
});

test("builds the closed runtime target set and returns one named report", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-runtime-builder-"));
  const outputRoot = join(root, "output");
  await mkdir(join(root, "cmd", "dev-flow"), { recursive: true });
  await writeFile(join(root, "CORE_VERSION"), "1.2.3\n");
  const builds = [];
  const run = async (executable, arguments_, options) => {
    assert.equal(executable, "go");
    if (arguments_[0] === "build") {
      const output = arguments_[arguments_.indexOf("-o") + 1];
      builds.push({ output, environment: options.environment });
      await writeFile(output, `${options.environment.GOOS}/${options.environment.GOARCH}\n`);
      return { stdout: "", stderr: "" };
    }
    const runtimePath = arguments_[2];
    const build = builds.find((entry) => entry.output === runtimePath);
    return {
      stdout: [
        runtimePath,
        `\tbuild\tGOOS=${build.environment.GOOS}`,
        `\tbuild\tGOARCH=${build.environment.GOARCH}`,
        "\tbuild\tCGO_ENABLED=0",
        "",
      ].join("\n"),
      stderr: "",
    };
  };
  t.after(() => rm(root, { recursive: true, force: true }));

  const report = await buildCoreRuntimes({
    repositoryRoot: root,
    outputRoot,
    buildAssets: false,
    run,
  });

  assert.equal(report.coreVersion, "1.2.3");
  assert.deepEqual(Object.keys(report.runtimes).sort(), ["darwin-arm64", "win32-x64"]);
  assert.equal(builds[0].environment.CGO_ENABLED, "0");
  assert.equal(builds[0].environment.GOOS, "darwin");
  assert.equal(builds[1].environment.GOOS, "windows");
  for (const runtime of Object.values(report.runtimes)) {
    assert.match(runtime.sha256, /^[0-9a-f]{64}$/u);
    assert.equal((await readFile(runtime.path, "utf8")).trim(), `${runtime.goos}/${runtime.goarch}`);
  }
});

test("runs the CLI entrypoint through an aliased script path", {
  skip: process.platform === "win32" ? "the release worktree path alias is specific to macOS and Unix" : false,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-runtime-entrypoint-"));
  const alias = join(root, "build-core-runtimes.mjs");
  await symlink(join(dirname(fileURLToPath(import.meta.url)), "build-core-runtimes.mjs"), alias);
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    runFile(process.execPath, [alias, "--invalid"], { encoding: "utf8" }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /usage: build-core-runtimes\.mjs --output ABSOLUTE_DIRECTORY/u);
      return true;
    },
  );
});
