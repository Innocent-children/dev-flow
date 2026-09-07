import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execPortableCommand } from "../lib/command.mjs";

const core = process.env.DEV_FLOW_WINDOWS_CORE;
test("Windows native WebUI starts, reuses its process, stops and reopens SQLite", {
  skip: process.platform === "win32" && process.arch === "x64" && core ? false : "set DEV_FLOW_WINDOWS_CORE on Windows x64",
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-windows-webui-"));
  const data = join(root, "中文 data with spaces");
  const executable = join(root, "dev-flow.exe");
  await copyFile(core, executable);
  await mkdir(data);
  const env = { ...process.env, DEV_FLOW_DATA_DIR: data };
  const run = async (...args) => {
    const { stdout } = await execPortableCommand(executable, ["webui", ...args, "--json"], {
      env, encoding: "utf8", timeout: 20_000, windowsHide: true,
    });
    return JSON.parse(stdout);
  };
  t.after(async () => {
    await run("stop");
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  // A real PowerShell caller must return while the background service stays up.
  const { stdout } = await execPortableCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    `& '${executable.replaceAll("'", "''")}' webui start --no-open --json`,
  ], { env, encoding: "utf8", windowsHide: true, timeout: 5000 });
  const started = JSON.parse(stdout);
  assert.equal(started.readiness, "ready");
  assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+$/u);
  const response = await fetch(`${started.url}/api/system/status`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).readiness, "ready");
  assert.equal((await run("start", "--no-open")).pid, started.pid);
  assert.equal((await run("status")).pid, started.pid);
  assert.equal((await run("stop")).readiness, "unavailable");
  assert.equal((await run("status")).readiness, "unavailable");
  assert.equal((await run("start", "--no-open")).readiness, "ready");
});
