import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";
import { runArtifactCommand } from "../skills/dev-flow/scripts/artifacts.mjs";

function capture() {
  let text = "";
  const stream = new Writable({ write(chunk, _encoding, callback) { text += chunk.toString(); callback(); } });
  return { stream, text: () => text };
}

test("artifact help and invalid operations do not read data or resolve the runtime", async () => {
  for (const args of [["--help"], ["collect", "--help"], ["prepare", "--help"], ["submit"]]) {
    const output = capture(), error = capture();
    const code = await runArtifactCommand(args, {
      input: { [Symbol.asyncIterator]() { assert.fail("help cannot read stdin"); } },
      output: output.stream, error: error.stream,
      selectRuntime: async () => assert.fail("help cannot resolve runtime"),
      resolveData: async () => assert.fail("help cannot resolve data"),
      spawnImpl: () => assert.fail("help cannot run Core"),
    });
    assert.equal(code, args[0] === "submit" ? 2 : 0);
  }
});

test("artifact commands forward exact stdin and the shared data directory to packaged Core", async () => {
  for (const operation of ["collect", "prepare"]) {
    const raw = JSON.stringify(operation === "collect"
      ? { host: "deepseek", task_id: "task-example", action_id: "action-example" }
      : { host: "deepseek", collection: { task_id: "task-example", action_id: "action-example", files: [] } }) + "\n";
    const output = capture(), error = capture();
    let received = "";
    const result = '{"ok":true,"result":{"example":true}}\n';
    const code = await runArtifactCommand([operation], {
      input: Readable.from([raw]), output: output.stream, error: error.stream,
      environment: { EXAMPLE: "preserved" },
      selectRuntime: async () => ({ runtimePath: "/package/runtime/dev-flow" }),
      resolveData: async ({ environment }) => { assert.equal(environment.EXAMPLE, "preserved"); return { dataDirectory: "/private/example-data" }; },
      spawnImpl(executable, args, options) {
        assert.equal(executable, "/package/runtime/dev-flow");
        assert.deepEqual(args, ["artifacts", operation]);
        assert.equal(options.shell, false);
        assert.deepEqual(options.env, { EXAMPLE: "preserved", DEV_FLOW_DATA_DIR: "/private/example-data" });
        const child = new EventEmitter();
        child.stdout = new PassThrough(); child.stderr = new PassThrough();
        child.stdin = new Writable({ write(chunk, _encoding, callback) { received += chunk.toString(); callback(); } });
        child.stdin.once("finish", () => { child.stdout.end(result); child.stderr.end(); child.emit("close", 0); });
        return child;
      },
    });
    assert.equal(code, 0);
    assert.equal(received, raw);
    assert.equal(output.text(), result);
    assert.equal(error.text(), "");
  }
});

test("artifact helper refuses another Host or malformed input before launching Core", async () => {
  for (const raw of ['{"host":"codex"}', '{', '\uFEFF{"host":"deepseek"}', '{"host":"deepseek","padding":"' + 'a'.repeat(1024 * 1024) + '"}']) {
    const output = capture(), error = capture();
    const code = await runArtifactCommand(["collect"], {
      input: Readable.from([raw]), output: output.stream, error: error.stream,
      selectRuntime: async () => assert.fail("invalid input cannot resolve runtime"),
      spawnImpl: () => assert.fail("invalid input cannot run Core"),
    });
    assert.equal(code, 1);
    assert.equal(output.text(), "");
    assert.match(error.text(), /DeepSeek artifact helper:/u);
  }
});
