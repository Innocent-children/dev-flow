import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execPortableCommand as codexCommand } from "../lib/command.mjs";
import { execPortableCommand as managerCommand } from "../../dev-flow/lib/command.mjs";

const nativeWindows = process.platform === "win32" && process.arch === "x64";

test("Windows command adapters preserve UTF-8, literal arguments and exit status", {
  skip: nativeWindows ? false : "requires Windows x64",
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-windows-command-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = join(root, "中文 command's output.ps1");
  const nodeScript = join(root, "中文 output.mjs");
  const failed = join(root, "failed.ps1");
  await writeFile(script, "ConvertTo-Json -InputObject @($args) -Compress\r\n");
  await writeFile(nodeScript, "console.log(JSON.stringify(process.argv.slice(2)));\n");
  await writeFile(failed, "exit 7\r\n");
  const args = ["中文", "space text", '{"key":"value"}', "a&b", "$(exit 9)", "a'b", ""];
  for (const run of [codexCommand, managerCommand]) {
    for (const executable of [script, nodeScript]) {
      const output = await run(executable, args, { encoding: "utf8", windowsHide: true });
      assert.deepEqual(JSON.parse(output.stdout), args);
      assert.equal(output.stderr, "");
    }
    await assert.rejects(run(failed, [], { encoding: "utf8", windowsHide: true }), error => error.code === 7);
    await assert.rejects(run(script, ["invalid\0argument"], { windowsHide: true }), /closed strings/u);
  }
});
