import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  copyExecutable,
  normalizeForwardedArguments,
  normalizeUstarArchive,
  stageAndPack,
  ustarEntryModes,
} from "./taskbelay-local.mjs";
import { hostCommandFiles } from "./sync-host-commands.mjs";

const execFile = promisify(execFileCallback);

test("Host source-only command archives regenerate stale copies from shared sources", async t => {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-command-staging-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const outputRoot = join(root, "artifacts");
  await mkdir(outputRoot);
  await mkdir(join(source, "skills/taskbelay/core"), { recursive: true });
  await writeFile(join(source, "skills/taskbelay/core/example.md"), 'Packaged Host: {{host}}\n');
  await cp(fileURLToPath(new URL("../packages/host-command", import.meta.url)), join(source, "packages/host-command"), { recursive: true });
  await writeFile(join(source, "LICENSE"), "Source-only staging fixture\n");
  for (const product of ["codex", "claude", "zcode"]) {
    const packageRoot = join(source, "packages", product);
    for (const path of hostCommandFiles) {
      const staleCopy = join(packageRoot, "lib", path);
      await mkdir(dirname(staleCopy), { recursive: true });
      await writeFile(staleCopy, "throw new Error('stale package copy');\n");
    }
    // This fixture tests source assembly and detached imports, not bundled Core runtimes.
    const skillDirectory = product === "zcode" ? "skills/taskbelay" : "plugin/skills/taskbelay";
    const reference = `${skillDirectory}/references/example.md`;
    await mkdir(dirname(join(packageRoot, reference)), { recursive: true });
    await writeFile(join(packageRoot, reference), "stale reference\n");
    const manifest = { name: `taskbelay-${product}`, version: "0.0.0", files: ["LICENSE", reference, ...hostCommandFiles.map(path => `lib/${path}`)] };
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(manifest));
    await writeFile(join(packageRoot, "README.md"), "Source-only command archive fixture\n");
    const artifact = await stageAndPack(product, {
      root: source, stageRoot: join(root, "stages"), outputRoot, coreArtifacts: new Map(), run: execFile,
    });
    const extracted = join(root, `${product}-extracted`);
    await mkdir(extracted);
    await execFile("tar", ["-xzf", artifact.path, "-C", extracted]);
    assert.match(await readFile(join(extracted, "package", reference), "utf8"), new RegExp(`Packaged Host: ${product}`));
    for (const path of hostCommandFiles) {
      const shared = (await readFile(join(source, "packages/host-command", path), "utf8")).replace(/\r\n?/gu, "\n");
      assert.equal(await readFile(join(extracted, "package/lib", path), "utf8"), `// Generated from packages/host-command/${path}; edit the shared source.\n${shared}`);
    }
    const commands = await import(pathToFileURL(join(extracted, "package/lib/command.mjs")));
    const result = await commands.execPortableCommand(process.execPath, ["-e", "process.stdout.write('detached')"], {
      cwd: extracted, encoding: "utf8", windowsHide: true, timeout: 10000,
    });
    assert.equal(result.stdout, "detached");
  }
});

test("local launcher forwards the existing taskbelay argument shape", () => {
  assert.deepEqual(normalizeForwardedArguments([]), []);
  assert.deepEqual(normalizeForwardedArguments(["--", "reinstall", "--host", "codex", "--yes"]), ["reinstall", "--host", "codex", "--yes"]);
});

test("local launcher stages bundled Core with executable permissions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-local-mode-test-"));
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

test("USTAR normalization assigns modes and removes host metadata", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-local-archive-mode-test-"));
  const packageRoot = join(root, "package");
  await mkdir(join(packageRoot, "runtime", "darwin-arm64"), { recursive: true });
  await mkdir(join(packageRoot, "runtime", "win32-x64"), { recursive: true });
  await writeFile(join(packageRoot, "runtime", "darwin-arm64", "taskbelay"), "darwin\n", { mode: 0o644 });
  await writeFile(join(packageRoot, "runtime", "win32-x64", "taskbelay.exe"), "windows\n", { mode: 0o644 });
  const tarPath = join(root, "package.tar");
  await execFile("tar", ["-cf", tarPath, "--format", "ustar", "-C", root, "package"]);

  const executablePaths = new Set([
    "package/runtime/darwin-arm64/taskbelay",
  ]);
  const normalized = normalizeUstarArchive(await readFile(tarPath), executablePaths);
  const modes = ustarEntryModes(normalized);
  assert.equal(modes.get("package/"), 0o755);
  assert.equal(modes.get("package/runtime/darwin-arm64/taskbelay"), 0o755);
  assert.equal(modes.get("package/runtime/win32-x64/taskbelay.exe"), 0o644);

  const changedTime = new Date("2030-01-02T03:04:05.000Z");
  await Promise.all([
    utimes(packageRoot, changedTime, changedTime),
    utimes(join(packageRoot, "runtime"), changedTime, changedTime),
    utimes(join(packageRoot, "runtime", "darwin-arm64"), changedTime, changedTime),
    utimes(join(packageRoot, "runtime", "win32-x64"), changedTime, changedTime),
    utimes(join(packageRoot, "runtime", "darwin-arm64", "taskbelay"), changedTime, changedTime),
    utimes(join(packageRoot, "runtime", "win32-x64", "taskbelay.exe"), changedTime, changedTime),
  ]);
  const secondTarPath = join(root, "package-second.tar");
  await execFile("tar", ["-cf", secondTarPath, "--format", "ustar", "-C", root, "package"]);
  const secondNormalized = normalizeUstarArchive(await readFile(secondTarPath), executablePaths);
  assert.deepEqual(secondNormalized, normalized);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});
