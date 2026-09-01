import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { copyExecutable, normalizeForwardedArguments } from "./dev-flow-local.mjs";

test("local launcher forwards the existing dev-flow argument shape", () => {
  assert.deepEqual(normalizeForwardedArguments([]), []);
  assert.deepEqual(normalizeForwardedArguments(["--", "reinstall", "--host", "codex", "--yes"]), ["reinstall", "--host", "codex", "--yes"]);
});

test("local launcher stages bundled Core with executable permissions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-local-mode-test-"));
  const source = join(root, "source");
  const target = join(root, "target");
  await writeFile(source, "core\n");
  await chmod(source, 0o644);

  await copyExecutable(source, target);

  if (process.platform !== "win32") assert.equal((await stat(target)).mode & 0o777, 0o755);
  assert.equal(await readFile(target, "utf8"), "core\n");
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});
