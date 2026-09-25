import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import { runClosedCommand } from "../lib/workspace-coordinator.mjs";

test("workspace commands retain both output streams after the direct child exits", async t => {
  const fixture = await inheritedOutput(t, 150);
  const controller = new AbortController();
  const result = await runClosedCommand(process.execPath, fixture.args, { timeoutMs: 5000, signal: controller.signal });
  assert.deepEqual(result, { code: 0, signal: null, stdout: "parent\0output\n尾部\0stdout\n", stderr: "尾部\0stderr\n" });
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

for (const interruption of ["timeout", "abort"]) {
  test(`workspace command ${interruption} stops waiting for inherited pipes after parent exit`, async t => {
    const fixture = await inheritedOutput(t, 1800);
    const controller = new AbortController();
    const pending = runClosedCommand(process.execPath, fixture.args, {
      timeoutMs: interruption === "timeout" ? 1000 : 5000, signal: controller.signal, mutating: true,
    });
    const rejected = assert.rejects(pending, error => {
      assert.equal(error.operationUncertain, true);
      assert.equal(typeof error.exitCode, "number");
      return true;
    });
    await waitForMarker(fixture.parentExited);
    if (interruption === "abort") controller.abort(new Error("stop while draining"));
    await rejected;
    assert.equal(await markerExists(fixture.descendantExited), false, "interruption waited for the descendant to close its pipes");
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });
}

for (const mutating of [false, true]) {
  test(`workspace command output overflow remains bounded with mutating=${mutating}`, async t => {
    const fixture = await inheritedOutput(t, 150, "x".repeat(128));
    await assert.rejects(runClosedCommand(process.execPath, fixture.args, {
      timeoutMs: 5000, maxOutputBytes: 32, mutating,
    }), error => {
      assert.equal(error.operationUncertain, mutating);
      assert.equal(typeof error.exitCode, "number");
      return true;
    });
  });
}

test("workspace commands preserve allowed exit codes and classify ordinary failures as certain", async () => {
  const args = ["-e", "process.stdout.write('out'); process.stderr.write('err'); process.exitCode = 2;"];
  assert.deepEqual(await runClosedCommand(process.execPath, args, { allowExitCodes: [0, 2] }), {
    code: 2, signal: null, stdout: "out", stderr: "err",
  });
  await assert.rejects(runClosedCommand(process.execPath, args, { mutating: true }), error => {
    assert.equal(error.exitCode, 2);
    assert.equal(error.operationUncertain, false);
    return true;
  });
});

test("workspace commands preserve pre-abort reasons and spawn errors", async t => {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-command-errors-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const controller = new AbortController();
  const reason = new Error("already aborted");
  controller.abort(reason);
  const missing = join(root, "missing-command");
  await assert.rejects(runClosedCommand(missing, [], { signal: controller.signal }), error => error === reason);
  const activeController = new AbortController();
  await assert.rejects(runClosedCommand(missing, [], { signal: activeController.signal }), { code: "ENOENT" });
  assert.equal(getEventListeners(activeController.signal, "abort").length, 0);
});

async function inheritedOutput(t, delayMs, output = "尾部\0stdout\n") {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-inherited-output-"));
  const parentExited = join(root, "parent-exited");
  const descendantExited = join(root, "descendant-exited");
  // A detached, short-lived descendant keeps inherited pipes open on Windows too.
  // Its own timer ends it even when the command runner closes those pipes early.
  const descendant = `
    const { writeFileSync } = require('node:fs');
    process.on('exit', () => writeFileSync(${JSON.stringify(descendantExited)}, 'done'));
    process.stdout.on('error', () => {});
    process.stderr.on('error', () => {});
    process.send('ready'); process.disconnect();
    setTimeout(() => {
      const output = Buffer.from(${JSON.stringify(output)}, 'utf8');
      process.stdout.write(output.subarray(0, 1));
      setTimeout(() => {
        process.stdout.end(output.subarray(1));
        process.stderr.end('尾部\\0stderr\\n');
      }, 5);
    }, ${delayMs});
  `;
  const parent = `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    process.on('exit', () => writeFileSync(${JSON.stringify(parentExited)}, 'done'));
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], {
      detached: true, windowsHide: true, stdio: ['ignore', 1, 2, 'ipc'],
    });
    child.once('message', () => process.stdout.write('parent\\0output\\n', () => process.exit(0)));
    child.unref();
  `;
  t.after(async () => {
    try { await waitForMarker(descendantExited); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  return { args: ["-e", parent], parentExited, descendantExited };
}

async function markerExists(path) {
  try { await readFile(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function waitForMarker(path) {
  const deadline = Date.now() + 5000;
  while (!await markerExists(path)) {
    assert.ok(Date.now() < deadline, `short-lived command fixture did not exit: ${path}`);
    await delay(10);
  }
}
