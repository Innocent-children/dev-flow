import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { checkHostCommands, hostCommandFiles, writeHostCommands } from "./sync-host-commands.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

test("Codex and Claude command copies match their maintained source", async () => {
  await checkHostCommands();
});

test("command copy checks tolerate checkout line endings and reject drift without writes", async t => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-command-copies-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(join(repositoryRoot, "packages/host-command"), join(root, "packages/host-command"), { recursive: true });
  for (const host of ["codex", "claude"]) {
    await writeHostCommands({ root, destination: join(root, "packages", host, "lib") });
  }
  const copy = join(root, "packages/claude/lib/command.mjs");
  const content = (await readFile(copy, "utf8")).replaceAll("\n", "\r\n");
  await writeFile(copy, content);
  await checkHostCommands({ root });
  const stale = content + "// separately edited copy\r\n";
  await writeFile(copy, stale);
  await assert.rejects(checkHostCommands({ root }), /packages\/claude\/lib\/command\.mjs differs/);
  assert.equal(await readFile(copy, "utf8"), stale);
});

test("generated commands execute outside the repository with literal arguments, stdin and exit status", async t => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-detached-commands-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeHostCommands({ destination: join(root, "lib") });
  const command = await import(pathToFileURL(join(root, "lib/command.mjs")));
  for (const path of hostCommandFiles) await import(pathToFileURL(join(root, "lib", path)));
  const args = ["中文", "space text", "a'b", "$(exit 9)", ""];
  const input = "中文输入\nsecond line\n";
  const program = "let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => console.log(JSON.stringify({ args: process.argv.slice(1), input })));";
  const result = await command.execPortableCommand(process.execPath, ["-e", program, ...args], {
    cwd: root, encoding: "utf8", input, windowsHide: true, timeout: 10000,
  });
  assert.deepEqual(JSON.parse(result.stdout), { args, input });
  assert.equal(result.stderr, "");
  await assert.rejects(command.execPortableCommand(process.execPath, ["-e", "console.error('failed'); process.exit(7)"], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000,
  }), error => error.code === 7 && error.stderr.trim() === "failed");
});
