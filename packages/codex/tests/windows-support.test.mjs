import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { execPortableCommand, findCommandPath } from "../lib/command.mjs";
import { inspectCoreVersion } from "../lib/lifecycle.mjs";
import { ensureDefaultDataDirectory, resolveProductPaths } from "../lib/paths.mjs";

const windowsCore = process.env.DEV_FLOW_WINDOWS_CORE;
const nativeWindows = process.platform === "win32" && process.arch === "x64";

test("Windows x64 selects the package-owned .exe and LOCALAPPDATA data root", {
  skip: nativeWindows ? false : "requires Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-windows-")));
  const packageRoot = join(root, "package");
  const home = join(root, "home");
  const localAppData = join(home, "AppData", "Local");
  await Promise.all([mkdir(packageRoot), mkdir(localAppData, { recursive: true })]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const paths = await resolveProductPaths({
    packageRoot,
    homeDirectory: home,
    platform: "win32",
    arch: "x64",
    environment: { LOCALAPPDATA: localAppData },
  });
  assert.equal(paths.runtimeKey, "win32-x64");
  assert.equal(paths.runtimePath, join(packageRoot, "runtime", "win32-x64", "dev-flow.exe"));
  assert.equal(paths.productSupportRoot, join(localAppData, "dev-flow"));
  assert.equal(paths.dataDirectory, join(localAppData, "dev-flow", "data"));
  assert.equal(await ensureDefaultDataDirectory(paths), paths.dataDirectory);
  assert.equal((await stat(paths.dataDirectory)).isDirectory(), true);

  for (const arch of ["ia32", "arm64"]) {
    await assert.rejects(
      resolveProductPaths({ packageRoot, homeDirectory: home, platform: "win32", arch, environment: { LOCALAPPDATA: localAppData } }),
      new RegExp(`unsupported platform win32-${arch}`, "u"),
    );
  }
  await assert.rejects(
    findCommandPath("definitely-missing-dev-flow-command", {
      platform: "win32",
      environment: { PATH: "" },
    }),
    (error) => error?.code === "ENOENT",
  );
});

test("Windows packaged Core executes natively and reports the repository Core version", {
  skip: nativeWindows && windowsCore ? false : "set DEV_FLOW_WINDOWS_CORE on Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-windows-core-")));
  const runtimePath = join(root, "dev-flow.exe");
  const home = join(root, "home");
  const dataDirectory = join(root, "data");
  await Promise.all([mkdir(home), mkdir(dataDirectory)]);
  await copyFile(windowsCore, runtimePath);
  t.after(() => rm(root, { recursive: true, force: true }));
  const expectedVersion = (await readFile(new URL("../../../CORE_VERSION", import.meta.url), "utf8")).trim();
  assert.equal(await inspectCoreVersion(runtimePath, { requireExecutableMode: false }), expectedVersion);

  const environment = {
    ...process.env,
    USERPROFILE: home,
    DEV_FLOW_DATA_DIR: dataDirectory,
  };
  delete environment.HOME;
  const mcp = await execPortableCommand(runtimePath, ["mcp", "--stdio"], {
    cwd: root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  assert.equal(mcp.stdout, "");
  assert.equal(mcp.stderr, "");
  assert.equal((await stat(join(dataDirectory, "dev-flow.db"))).isFile(), true);
});

test("Windows Codex hook command runs under cmd and Windows PowerShell", {
  skip: nativeWindows ? false : "requires Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-windows-hook-")));
  const launcherPath = fileURLToPath(new URL("../bin/dev-flow-codex.mjs", import.meta.url));
  const hooks = JSON.parse(await readFile(new URL("../plugin/hooks/hooks.json", import.meta.url), "utf8"));
  const command = hooks.hooks.PreToolUse[0].hooks[0].command;
  await writeFile(
    join(root, "dev-flow-codex.cmd"),
    `@echo off\r\n\"${process.execPath}\" \"${launcherPath}\" %*\r\n`,
    "utf8",
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = `${JSON.stringify({ hook_event_name: "SessionStart" })}\n`;
  const environment = {
    ...process.env,
    PATH: `${root};${process.env.PATH ?? ""}`,
  };
  const cmd = spawnSync(process.env.COMSPEC || "cmd.exe", ["/d", "/s", "/c", command], {
    env: environment,
    input,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(cmd.status, 0, cmd.stderr);

  const powershell = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
    env: environment,
    input,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(powershell.status, 0, powershell.stderr);
});
