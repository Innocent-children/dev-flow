import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);

test("manifest-listed lifecycle modules run without repository files", async t => {
  const source = fileURLToPath(new URL("../", import.meta.url));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-staged-cli-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  for (const file of ["package.json", ...manifest.files.filter(file => file.endsWith(".mjs"))]) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(source, file), destination);
  }
  const result = await execFile(process.execPath, [join(root, "bin/dev-flow.mjs"), "help"], { cwd: root, encoding: "utf8" });
  assert.match(result.stdout, /claude/);
  assert.equal(result.stderr, "");
});
