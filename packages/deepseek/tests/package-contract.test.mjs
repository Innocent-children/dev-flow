import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const execFile = promisify(execFileCallback);

const expectedPackageFiles = [
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "lib/authorization.mjs",
  "lib/index.mjs",
  "lib/paths.mjs",
  "lib/runtime.mjs",
  "lib/tool-names.mjs",
  "runtime/darwin-arm64/dev-flow",
  "skills/dev-flow/SKILL.md",
  "skills/dev-flow/references/method-profiles.md",
  "skills/dev-flow/references/node-payloads.md",
];

const lifecycleHooks = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishOnly",
  "publish",
  "postpublish",
  "preuninstall",
  "uninstall",
  "postuninstall",
];

test("manifest declares one unpublished ESM DeepSeek bundle", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));

  assert.equal(manifest.name, "dev-flow-deepseek");
  assert.equal(manifest.version, "0.5.0");
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.equal(manifest.main, "lib/index.mjs");
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.engines, { node: ">=24" });
  assert.deepEqual(manifest.dsh, {
    bundle: {
      patch: "./cordis.patch.yml",
    },
  });
  assert.equal("bin" in manifest, false);
  assert.equal("publishConfig" in manifest, false);
});

test("manifest closes package, dependency, and lifecycle surfaces", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));

  assert.deepEqual([...manifest.files].sort(), [...expectedPackageFiles].sort());
  assert.equal(manifest.files.some((path) => /[*?[\]{}]/u.test(path)), false);
  assert.deepEqual(manifest.dependencies, {
    "@deepseek-ai/dsh-mcp-client": ">=0.1.0-rc.8 <0.2.0",
  });
  assert.deepEqual(manifest.peerDependencies, {
    "@deepseek-ai/cordis": ">=4.0.1 <5.0.0",
    "@deepseek-ai/dsh-skill": ">=0.1.0-rc.8 <0.2.0",
    "@deepseek-ai/dsh-tools": ">=0.1.0-rc.8 <0.2.0",
  });

  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(
      Object.hasOwn(manifest, field) && Object.hasOwn(manifest[field], "dev-flow-codex"),
      false,
      field,
    );
  }

  for (const hook of lifecycleHooks) {
    assert.equal(Object.hasOwn(manifest.scripts, hook), false, hook);
  }
});

test("dry pack contains only declared product files and excludes development state", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const { stdout } = await execFile(
    "pnpm",
    ["--config.ignore-scripts=true", "--dir", packageRoot, "pack", "--dry-run", "--json"],
    { encoding: "utf8" },
  );
  const report = JSON.parse(stdout);
  const packed = Array.isArray(report) ? report[0] : report;
  const packedFiles = (packed.files ?? [])
    .map((file) => (typeof file === "string" ? file : file.path ?? file.name))
    .sort();
  const existingDeclaredFiles = [];

  for (const path of manifest.files) {
    try {
      if ((await stat(join(packageRoot, path))).isFile()) existingDeclaredFiles.push(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const expectedPackedFiles = [...new Set([
    "LICENSE",
    "README.md",
    "package.json",
    ...existingDeclaredFiles,
  ])].sort();
  assert.equal(packed.name, "dev-flow-deepseek");
  assert.deepEqual(packedFiles, expectedPackedFiles);
  assert.equal(packedFiles.some((path) => /(?:^|\/)(?:tests?|evidence|profiles?|data)(?:\/|$)/iu.test(path)), false);
  assert.equal(packedFiles.some((path) => /\.(?:db|sqlite|tgz|map)$/iu.test(path)), false);
});

test("packaged Core is detached, CGo-free, versioned, and accepts STDIO startup", async (t) => {
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const currentVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();
  const dataDirectory = await mkdtemp(join(tmpdir(), "dev-flow-deepseek-core-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(dataDirectory, { recursive: true, force: true });
  });

  const { stdout: versionOutput } = await execFile(runtimePath, ["version"], {
    cwd: dataDirectory,
    encoding: "utf8",
  });
  assert.equal(versionOutput, `dev-flow ${currentVersion}\n`);

  const { stdout: buildMetadata } = await execFile("go", ["version", "-m", runtimePath], {
    encoding: "utf8",
  });
  assert.match(buildMetadata, /\tbuild\tCGO_ENABLED=0(?:\n|$)/u);
  assert.match(buildMetadata, /\tbuild\tGOOS=darwin(?:\n|$)/u);
  assert.match(buildMetadata, /\tbuild\tGOARCH=arm64(?:\n|$)/u);

  const { stdout, stderr } = await runWithClosedInput(runtimePath, ["mcp", "--stdio"], {
    cwd: dataDirectory,
    env: { DEV_FLOW_DATA_DIR: dataDirectory },
  });
  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

async function runWithClosedInput(command, args, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`packaged Core exited with code ${code} and signal ${signal ?? "none"}: ${stderr}`));
    });
    child.stdin.end();
  });
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
