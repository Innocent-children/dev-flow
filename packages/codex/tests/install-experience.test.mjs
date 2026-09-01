import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_USER_CONFIGURATION,
  buildSetupSuccessResult,
  ensureUserConfiguration,
  renderSetup,
  renderSetupPlain,
  resolveSetupLanguage,
  selectSetupPresentationMode,
} from "../lib/install-experience.mjs";

test("creates one closed default user configuration with private modes", async () => {
  const paths = await fixturePaths();
  const result = await ensureUserConfiguration(paths);
  assert.deepEqual(result.fileChange, { path: paths.configurationPath, change: "created" });
  assert.equal(await readFile(paths.configurationPath, "utf8"), DEFAULT_USER_CONFIGURATION);
  if (process.platform !== "win32") {
    assert.equal((await lstat(paths.configurationDirectory)).mode & 0o777, 0o700);
    assert.equal((await lstat(paths.configurationPath)).mode & 0o777, 0o600);
  }
});

test("preserves valid existing configuration and adjacent files byte for byte", async () => {
  const paths = await fixturePaths();
  const existing = '{"codex":{"codebase_memory":true}}\n';
  const adjacent = join(paths.configurationDirectory, "notes.txt");
  await mkdir(paths.configurationDirectory, { recursive: true, mode: 0o700 });
  await writeFile(paths.configurationPath, existing, { mode: 0o600 });
  await writeFile(adjacent, "keep\n", { mode: 0o600 });
  const result = await ensureUserConfiguration(paths);
  assert.equal(result.fileChange, null);
  assert.equal(await readFile(paths.configurationPath, "utf8"), existing);
  assert.equal(await readFile(adjacent, "utf8"), "keep\n");
});

test("rejects invalid, duplicate, unknown, nonboolean, oversized, and unsafe existing files", async (t) => {
  const cases = [
    ["invalid", "{", /invalid JSON/],
    ["duplicate", '{"codex":{},"codex":{}}', /invalid JSON/],
    ["unknown", '{"other":{}}', /unknown top-level/],
    ["nonboolean", '{"codex":{"codebase_memory":"yes"}}', /must be a boolean/],
    ["oversized", `{"codex":{}}${" ".repeat(16 * 1024)}`, /exceeds 16 KiB/],
  ];
  for (const [name, contents, pattern] of cases) {
    await t.test(name, async () => {
      const paths = await fixturePaths();
      await mkdir(paths.configurationDirectory, { recursive: true, mode: 0o700 });
      await writeFile(paths.configurationPath, contents, { mode: 0o600 });
      await assert.rejects(ensureUserConfiguration(paths), pattern);
      assert.equal(await readFile(paths.configurationPath, "utf8"), contents);
    });
  }

  const unsafe = await fixturePaths();
  await mkdir(unsafe.configurationDirectory, { recursive: true, mode: 0o700 });
  await writeFile(unsafe.configurationPath, "{}\n", { mode: 0o644 });
  await chmod(unsafe.configurationPath, 0o644);
  unsafe.platform = "darwin";
  await assert.rejects(ensureUserConfiguration(unsafe), /permissions are unsafe/);
});

test("rejects symbolic-link and non-file configuration targets", async () => {
  if (process.platform !== "win32") {
    const linkPaths = await fixturePaths();
    const outside = join(linkPaths.homeDirectory, "outside.json");
    await mkdir(linkPaths.configurationDirectory, { recursive: true, mode: 0o700 });
    await writeFile(outside, "{}\n", { mode: 0o600 });
    await symlink(outside, linkPaths.configurationPath);
    await assert.rejects(ensureUserConfiguration(linkPaths), /regular non-symbolic-link file/);
  }

  const directoryPaths = await fixturePaths();
  await mkdir(directoryPaths.configurationPath, { recursive: true, mode: 0o700 });
  await assert.rejects(ensureUserConfiguration(directoryPaths), /regular non-symbolic-link file/);
});

test("builds stable setup facts and plain output", async () => {
  const result = buildSetupSuccessResult(
    { status: "installed", fileChanges: [{ path: "/receipt.json", change: "created" }] },
    { configurationPath: "/config.json", fileChange: { path: "/config.json", change: "created" } },
    "/receipt.json",
  );
  assert.deepEqual(result, {
    operation: "setup",
    status: "installed",
    changed: true,
    receipt_path: "/receipt.json",
    configuration_path: "/config.json",
    file_changes: [
      { path: "/config.json", change: "created" },
      { path: "/receipt.json", change: "created" },
    ],
    next_step: "Review and trust the Dev Flow hook with /hooks, then use $dev-flow-codex:dev-flow <task description>",
  });
  assert.match(renderSetupPlain(result, "en"), /created: \/config\.json/);
  assert.match(renderSetupPlain(result, "zh-CN"), /下一步/);
});

test("renders one bounded Simplified Chinese Dev Flow screen", () => {
  const result = setupResult();
  const output = renderSetup(result, { language: "zh-CN", mode: "rich" });
  const logicalLines = output.trimEnd().split("\n");
  assert.ok(logicalLines.length >= 5 && logicalLines.length <= 8);
  assert.match(output, /DEV FLOW · CODEX/);
  assert.match(output, /设置完成，Codex 已就绪/);
  assert.match(output, /下一步/);
  assert.equal((output.match(/\$dev-flow-codex:dev-flow/g) ?? []).length, 1);
  assert.doesNotMatch(output, /Houston|Oh My Zsh|Starship|Astro|Bun/u);
});

test("selects English plain output for narrow, NO_COLOR, dumb, non-TTY, and unsupported locale", () => {
  assert.equal(resolveSetupLanguage({ LANG: "zh_CN.UTF-8" }), "zh-CN");
  assert.equal(resolveSetupLanguage({ LC_MESSAGES: "zh-Hans" }), "zh-CN");
  assert.equal(resolveSetupLanguage({ LC_ALL: "fr_FR.UTF-8", LANG: "zh_CN.UTF-8" }), "en");
  assert.equal(selectSetupPresentationMode({ isTTY: false, columns: 120 }, {}), "plain");
  assert.equal(selectSetupPresentationMode({ isTTY: true, columns: 79 }, { TERM: "xterm" }), "plain");
  assert.equal(selectSetupPresentationMode({ isTTY: true, columns: 120 }, { TERM: "xterm", NO_COLOR: "" }), "plain");
  assert.equal(selectSetupPresentationMode({ isTTY: true, columns: 120 }, { TERM: "dumb" }), "plain");
  assert.equal(selectSetupPresentationMode({ isTTY: true, columns: 120 }, { TERM: "xterm" }), "rich");

  const plain = renderSetup(setupResult(), { language: "en", mode: "plain" });
  assert.match(plain, /configuration: \/config\.json/);
  assert.match(plain, /next:/);
  assert.doesNotMatch(plain, /\u001b\[|[╭╮╰╯]/u);
});

function setupResult() {
  return buildSetupSuccessResult(
    { status: "installed", fileChanges: [{ path: "/receipt.json", change: "created" }] },
    { configurationPath: "/config.json", fileChange: { path: "/config.json", change: "created" } },
    "/receipt.json",
  );
}

async function fixturePaths() {
  const homeDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-install-"));
  const configurationDirectory = join(homeDirectory, ".dev-flow");
  return {
    homeDirectory,
    platform: process.platform,
    configurationDirectory,
    configurationPath: join(configurationDirectory, "config.json"),
  };
}
