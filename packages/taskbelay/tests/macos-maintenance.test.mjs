import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, copyFile, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { assertManagedCoresStopped, stopStdioCores } from "../lib/platform/macos/core-processes.mjs";

test("macOS native maintenance stops only the isolated executable with complete STDIO arguments", { skip: process.platform !== "darwin", timeout: 15000 }, async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "taskbelay-native-process-")));
  const executable = join(root, "isolated-core");
  await copyFile(process.execPath, executable);
  await chmod(executable, 0o755);
  const script = 'process.stdout.write("ready\\n"); setInterval(() => {}, 1000);\n';
  await writeFile(join(root, "mcp"), script);
  await writeFile(join(root, "other"), script);
  const children = [];
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
    }
    await rm(root, { recursive: true, force: true });
  });
  for (const args of [["mcp", "--stdio"], ["other", "--stdio"]]) {
    const child = spawn(executable, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: {
      ...process.env,
      DYLD_LIBRARY_PATH: [dirname(process.execPath), join(dirname(process.execPath), "..", "lib"), process.env.DYLD_LIBRARY_PATH].filter(Boolean).join(":"),
    } });
    children.push(child);
    let stderr = "";
    child.stderr.on("data", value => { stderr += value; });
    const [ready] = await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(([code, signal]) => { throw new Error(`Isolated process exited before ready: ${code}/${signal}: ${stderr}`); }),
    ]);
    assert.equal(ready.toString(), "ready\n");
  }
  await assert.rejects(assertManagedCoresStopped([executable]), /still running/);
  const stopped = once(children[0], "exit");
  await stopStdioCores([executable]);
  await stopped;
  await assertManagedCoresStopped([executable]);
  assert.equal(children[1].exitCode, null);
  assert.equal(children[1].signalCode, null);
});

test("macOS process simulation rejects changed startup identity before signalling", async () => {
  let startReads = 0, signals = 0;
  const run = async (_exe, args) => {
    if (args.includes("-axo")) return { stdout: "42 /managed/core\n43 /other/core\n" };
    const field = args.at(-1);
    return { stdout: field === "lstart=" ? ++startReads === 1 ? "first start" : "changed start"
      : field === "comm=" ? "/managed/core" : "/managed/core mcp --stdio" };
  };
  await assert.rejects(stopStdioCores(["/managed/core"], { run, signal: () => signals++ }), /identity changed/);
  assert.equal(signals, 0);
});

test("macOS process simulation rejects a surviving Core and checks complete arguments", async () => {
  let command = "/managed/core mcp --stdio extra", time = 0, signals = 0;
  const run = async (_exe, args) => ({ stdout: args.includes("-axo") ? "42 /managed/core\n"
    : args.at(-1) === "lstart=" ? "same start" : args.at(-1) === "comm=" ? "/managed/core" : command });
  await stopStdioCores(["/managed/core"], { run, signal: () => signals++ });
  assert.equal(signals, 0);
  command = "/managed/core mcp --stdio";
  await assert.rejects(stopStdioCores(["/managed/core"], { run, signal: () => signals++, now: () => time += 6000 }), /did not exit/);
  assert.equal(signals, 1);
  command = "/managed/core webui serve";
  await assert.rejects(assertManagedCoresStopped(["/managed/core"], { run }), /still running/);
});
