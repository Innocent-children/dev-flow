import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  copyExecutable,
  normalizeForwardedArguments,
  normalizeUstarModes,
  ustarEntryModes,
} from "./dev-flow-local.mjs";

const execFile = promisify(execFileCallback);

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

test("Windows staging leaves POSIX mode ownership to the archive", async () => {
  let chmodCalls = 0;
  await copyExecutable("source", "target", {
    platform: "win32",
    requireExecutableMode: true,
    copyFile: async () => {},
    chmod: async () => { chmodCalls += 1; },
  });
  assert.equal(chmodCalls, 0);
});

test("USTAR normalization assigns executable modes without host filesystem support", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-local-archive-mode-test-"));
  const packageRoot = join(root, "package");
  await mkdir(join(packageRoot, "runtime", "darwin-arm64"), { recursive: true });
  await mkdir(join(packageRoot, "runtime", "win32-x64"), { recursive: true });
  await writeFile(join(packageRoot, "runtime", "darwin-arm64", "dev-flow"), "darwin\n", { mode: 0o644 });
  await writeFile(join(packageRoot, "runtime", "win32-x64", "dev-flow.exe"), "windows\n", { mode: 0o644 });
  const tarPath = join(root, "package.tar");
  await execFile("tar", ["-cf", tarPath, "--format", "ustar", "-C", root, "package"]);

  const normalized = normalizeUstarModes(await readFile(tarPath), new Set([
    "package/runtime/darwin-arm64/dev-flow",
  ]));
  const modes = ustarEntryModes(normalized);
  assert.equal(modes.get("package/"), 0o755);
  assert.equal(modes.get("package/runtime/darwin-arm64/dev-flow"), 0o755);
  assert.equal(modes.get("package/runtime/win32-x64/dev-flow.exe"), 0o644);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});
