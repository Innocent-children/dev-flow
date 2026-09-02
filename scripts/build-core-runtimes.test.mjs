import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { platformAdapter as codexPlatform } from "../packages/codex/lib/platform.mjs";
import { platformAdapter as deepseekPlatform } from "../packages/deepseek/lib/platform.mjs";
import { platformAdapter as managerPlatform } from "../packages/dev-flow/lib/platform.mjs";
import { buildCoreRuntimes, CORE_RUNTIME_TARGETS } from "./build-core-runtimes.mjs";

test("package platform implementations match the runtime target catalog", () => {
  for (const target of CORE_RUNTIME_TARGETS) {
    const platform = target.runtimeKey.split("-")[0];
    const arch = target.runtimeKey.split("-")[1];
    for (const select of [codexPlatform, deepseekPlatform, managerPlatform]) {
      const adapter = select(platform, arch);
      assert.equal(adapter.runtimeKey, target.runtimeKey);
      assert.equal(adapter.runtimeDirectory, target.runtimeKey);
      assert.equal(adapter.runtimeExecutable, target.executable);
      assert.equal(adapter.requireExecutableMode, target.requireExecutableMode);
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
