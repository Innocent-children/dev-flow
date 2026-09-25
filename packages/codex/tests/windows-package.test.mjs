import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { execPortableCommand } from "../lib/command.mjs";
import { desktopSourceFiles } from "../../../scripts/desktop-pet-package.mjs";

const core = process.env.TASKBELAY_WINDOWS_CORE;
const repository = fileURLToPath(new URL("../../../", import.meta.url));
test("Windows source verification archives load platform modules and the native Core", {
  skip: process.platform === "win32" && process.arch === "x64" && core ? false : "set TASKBELAY_WINDOWS_CORE on Windows x64",
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "taskbelay-windows-package-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const expectedVersion = (await readFile(join(repository, "CORE_VERSION"), "utf8")).trim();
  for (const product of ["codex", "deepseek", "taskbelay"]) {
    const source = join(repository, "packages", product);
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    // Source and native Core verification excludes generated desktop apps and publishable dual-runtime packages.
    const sourceFiles = product === "taskbelay" ? desktopSourceFiles(manifest) : manifest.files;
    const files = [...new Set(["package.json", "README.md", ...sourceFiles])]
      .filter(path => !path.startsWith("runtime/darwin-arm64/"));
    const stage = join(root, product, "stage");
    for (const path of files) {
      const target = join(stage, "package", path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(path === "LICENSE" ? join(repository, path)
        : path === "runtime/win32-x64/taskbelay.exe" ? core : join(source, path), target);
    }
    const archive = join(root, product, "windows-verification.tgz");
    const extracted = join(root, product, "extracted");
    await mkdir(extracted);
    await execPortableCommand("tar", ["-czf", archive, "-C", stage, "package"], { windowsHide: true });
    await execPortableCommand("tar", ["-xzf", archive, "-C", extracted], { windowsHide: true });
    const packed = join(extracted, "package");
    for (const path of files) assert.deepEqual(await readFile(join(packed, path)), await readFile(join(stage, "package", path)), path);
    const platform = await import(pathToFileURL(join(packed, "lib/platform.mjs")));
    assert.equal(platform.runtimeDescriptor("win32", "x64").runtimeExecutable, "taskbelay.exe");
    if (product === "deepseek") {
      const runtime = await import(pathToFileURL(join(packed, "lib/runtime.mjs")));
      const selected = await runtime.selectPackagedRuntime({ packageRoot: packed, platform: "win32", arch: "x64" });
      assert.equal((await runtime.preflightPackagedCore(selected)).version, expectedVersion);
    } else {
      const entry = product === "codex" ? "taskbelay-codex.mjs" : "taskbelay.mjs";
      const { stdout } = await execPortableCommand(process.execPath, [join(packed, "bin", entry), "--version"], {
        encoding: "utf8", windowsHide: true,
      });
      assert.ok(stdout.includes(product === "codex" ? expectedVersion : manifest.version), stdout);
    }
  }
});
