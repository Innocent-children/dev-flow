import assert from "node:assert/strict";
import { execFile as callback } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import test from "node:test";

import { buildHostRelease, parseArguments } from "../scripts/build-host-release.mjs";
import { normalizeUstarArchive } from "../scripts/taskbelay-local.mjs";
import { hostVersionPaths, writeHostVersion } from "../release/host-versions.mjs";
import { releaseOutputNames } from "../release/prepare.mjs";
import { HOST_PRODUCTS } from "../release/products.mjs";

const execFile = promisify(callback);

async function fixture(t, product, version = "1.2.3") {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "host-release-prepare-test-")));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, "repository");
  const output = join(temporary, "output");
  await mkdir(root);
  await mkdir(output);
  const manifest = {
    name: `taskbelay-${product}`, version, license: "Apache-2.0",
    os: ["darwin", "win32"], cpu: ["arm64", "x64"],
    publishConfig: { access: "public", registry: "https://registry.npmjs.org/" },
  };
  for (const path of hostVersionPaths(product)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    const document = path.endsWith("/package.json") ? manifest : path.endsWith("/marketplace.json")
      ? { name: "taskbelay-zcode-local", plugins: [{ name: manifest.name, version }] }
      : { name: manifest.name, version };
    await writeFile(join(root, path), JSON.stringify(document));
  }
  await writeFile(join(root, "CORE_VERSION"), "4.5.6\n");
  await writeFile(join(root, "source.txt"), "original source\n");
  const git = async args => (await execFile("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  await git(["init", "-b", "main"]);
  await git(["config", "user.name", "Release Preparation Test"]);
  await git(["config", "user.email", "release-test@example.invalid"]);
  await git(["config", "commit.gpgsign", "false"]);
  const commit = async () => {
    await git(["add", "."]);
    await git(["commit", "-m", "test fixture"]);
    return git(["rev-parse", "HEAD"]);
  };
  const sourceCommit = await commit();
  const sourceTree = await git(["rev-parse", "HEAD^{tree}"]);
  return { root, output, temporary, product, version, sourceCommit, sourceTree, git, commit };
}

function builder(f, options = {}) {
  const builds = [];
  const clones = [];
  async function run(executable, args, { cwd, environment } = {}) {
    if (executable === "uname") return { stdout: args[0] === "-s" ? (options.os ?? "Darwin") : "arm64" };
    if (executable === "git" && args[0] === "clone") clones.push(args.at(-1));
    if (["sh", process.execPath].includes(executable) && /build-.*-local\.(sh|mjs)$/u.test(args[0] ?? "")) {
      const manifest = JSON.parse(await readFile(join(cwd, "packages", f.product, "package.json"), "utf8"));
      const sourceCommit = (await execFile("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" })).stdout.trim();
      builds.push({ cwd, builder: args[0], sourceCommit, source: await readFile(join(cwd, "source.txt"), "utf8") });
      if (options.failBuild) throw new Error("fixture build failed");
      const stage = join(environment.TMPDIR, "stage");
      await mkdir(join(stage, "package", "runtime", "darwin-arm64"), { recursive: true });
      await mkdir(join(stage, "package", "runtime", "win32-x64"), { recursive: true });
      const packedManifest = options.wrongPackage ? { ...manifest, name: "wrong-package" } : manifest;
      await writeFile(join(stage, "package", "package.json"), JSON.stringify(packedManifest));
      await writeFile(join(stage, "package", "runtime", "darwin-arm64", "taskbelay"), "fixture darwin Core\n");
      await writeFile(join(stage, "package", "runtime", "win32-x64", "taskbelay.exe"), `fixture Windows Core ${options.nonDeterministic ? builds.length : ""}\n`);
      const archive = join(environment.TMPDIR, "package.tar");
      await execFile("tar", ["-cf", archive, "--format", "ustar", "-C", stage, "package"]);
      const artifact = join(args[2], `${manifest.name}-${manifest.version}.tgz`);
      await writeFile(artifact, gzipSync(normalizeUstarArchive(await readFile(archive)), { mtime: 0 }));
      if (options.changeFrozenSource) await writeFile(join(cwd, "source.txt"), "changed frozen source\n");
      if (options.afterBuild) await options.afterBuild(builds.length);
      const report = ["codex", "deepseek"].includes(f.product)
        ? { artifact_path: artifact, package_version: manifest.version, core_version: "4.5.6", source_commit: sourceCommit, source_dirty: false }
        : { path: artifact, version: manifest.version };
      return { stdout: JSON.stringify({ ...report, ...options.report }) };
    }
    return execFile(executable, args, { cwd, env: environment, encoding: "utf8" });
  }
  return { run, builds, clones };
}

async function prepare(f, runner, channel = "stable", output = f.output) {
  return buildHostRelease({
    product: f.product, repositoryRoot: f.root, outputDirectory: output,
    environment: { ...process.env, TASKBELAY_RELEASE_CHANNEL: channel }, run: runner.run,
  });
}

async function assertCleaned(runner) {
  for (const clone of runner.clones) await assert.rejects(stat(dirname(clone)), { code: "ENOENT" });
}

for (const product of HOST_PRODUCTS) {
  test(`${product} prepares the five-file output from two independent frozen builds`, async t => {
    const f = await fixture(t, product);
    const runner = builder(f);
    const result = await prepare(f, runner);
    assert.equal(result.product, product);
    assert.equal(result.version, f.version);
    assert.equal(result.core_version, "4.5.6");
    assert.equal(result.source_commit, f.sourceCommit);
    assert.deepEqual((await readdir(f.output)).sort(), releaseOutputNames(product, f.version, "4.5.6"));
    const saved = JSON.parse(await readFile(join(f.output, "release-manifest.json"), "utf8"));
    assert.equal(saved.release.source_tree, f.sourceTree);
    assert.equal(saved.artifacts.length, 3);
    assert.equal(runner.builds.length, 2);
    assert.notEqual(runner.builds[0].cwd, runner.builds[1].cwd);
    assert.ok(runner.builds.every(build => build.sourceCommit === f.sourceCommit && build.source === "original source\n"));
    const expectedBuilder = product === "codex" ? "build-codex-local.sh" : `build-${product}-local.mjs`;
    assert.ok(runner.builds.every(build => build.builder.endsWith(`/scripts/${expectedBuilder}`)));
    assert.equal(await f.git(["status", "--porcelain"]), "");
    assert.equal(await f.git(["rev-parse", "HEAD"]), f.sourceCommit);
    await assertCleaned(runner);
  });
}

test("preparation keeps the selected source and versions when the operator checkout advances", async t => {
  const f = await fixture(t, "zcode");
  const runner = builder(f, { afterBuild: async count => {
    if (count !== 1) return;
    await writeHostVersion(f.root, f.product, f.version, "9.9.9");
    await writeFile(join(f.root, "CORE_VERSION"), "8.8.8\n");
    await writeFile(join(f.root, "source.txt"), "later source\n");
    await f.commit();
  } });
  const result = await prepare(f, runner);
  assert.notEqual(await f.git(["rev-parse", "HEAD"]), f.sourceCommit);
  assert.equal(result.version, f.version);
  assert.equal(result.core_version, "4.5.6");
  assert.equal(result.source_commit, f.sourceCommit);
  assert.ok(runner.builds.every(build => build.sourceCommit === f.sourceCommit && build.source === "original source\n"));
  await assertCleaned(runner);
});

test("beta preparation accepts a named feature branch with synchronized beta versions", async t => {
  const f = await fixture(t, "claude", "1.2.3-beta.4");
  await f.git(["switch", "-c", "feature/release"]);
  const runner = builder(f);
  assert.equal((await prepare(f, runner, "beta")).version, "1.2.3-beta.4");
  await assertCleaned(runner);
});

test("different independent build bytes are rejected before writing release output", async t => {
  const f = await fixture(t, "claude");
  const runner = builder(f, { nonDeterministic: true });
  await assert.rejects(prepare(f, runner), /not deterministic/u);
  assert.deepEqual(await readdir(f.output), []);
  await assertCleaned(runner);
});

test("an interruption after the last build command cannot return a successful prepared release", async t => {
  const f = await fixture(t, "claude");
  const runner = builder(f);
  const controller = new AbortController();
  let manifestReads = 0;
  const run = async (executable, args, options) => {
    const result = await runner.run(executable, args, options);
    if (executable === "tar" && args.at(-1) === "package/package.json" && ++manifestReads === 2) {
      setTimeout(() => controller.abort(), 0);
    }
    return result;
  };
  await assert.rejects(buildHostRelease({
    product: f.product, repositoryRoot: f.root, outputDirectory: f.output,
    environment: { ...process.env, TASKBELAY_RELEASE_CHANNEL: "stable" },
    run, signal: controller.signal,
  }), { name: "AbortError" });
  assert.equal(manifestReads, 2);
  assert.deepEqual((await readdir(f.output)).sort(), releaseOutputNames(f.product, f.version, "4.5.6"));
  await assertCleaned(runner);
});

for (const [description, options, expected] of [
  ["builder failure", { failBuild: true }, /fixture build failed/u],
  ["modified frozen source", { changeFrozenSource: true }, /frozen build source/u],
  ["incorrect packed package identity", { wrongPackage: true }, /fixed public contract/u],
  ["incorrect build report version", { report: { version: "9.9.9" } }, /build source or version mismatch/u],
]) {
  test(`preparation rejects ${description} and removes temporary resources`, async t => {
    const f = await fixture(t, "zcode");
    const runner = builder(f, options);
    await assert.rejects(prepare(f, runner), expected);
    assert.deepEqual(await readdir(f.output), []);
    await assertCleaned(runner);
  });
}

test("Codex and DeepSeek build reports must name the frozen commit and clean source", async t => {
  for (const product of ["codex", "deepseek"]) {
    const f = await fixture(t, product);
    const runner = builder(f, { report: { source_commit: "0".repeat(40), source_dirty: true } });
    await assert.rejects(prepare(f, runner), /build source or version mismatch/u);
    await assertCleaned(runner);
  }
});

test("source, channel, platform and mirror preconditions stop before cloning", async t => {
  for (const [description, configure, channel, runnerOptions, expected] of [
    ["branch", f => f.git(["switch", "-c", "feature/release"]), "stable", {}, /requires branch main/u],
    ["detached", f => f.git(["checkout", "--detach"]), "beta", {}, /requires a named branch/u],
    ["dirty", f => writeFile(join(f.root, "source.txt"), "dirty\n"), "stable", {}, /requires a clean checkout/u],
    ["channel", async () => {}, "nightly", {}, /stable or beta/u],
    ["version", async () => {}, "beta", {}, /beta channel requires/u],
    ["platform", async () => {}, "stable", { os: "Linux" }, /requires darwin-arm64/u],
    ["mirror", async f => {
      await writeFile(join(f.root, "packages/claude/.claude-plugin/plugin.json"), JSON.stringify({ name: "taskbelay-claude", version: "9.9.9" }));
      await f.commit();
    }, "stable", {}, /versions must agree/u],
  ]) {
    await t.test(description, async t => {
      const f = await fixture(t, "claude");
      await configure(f);
      const runner = builder(f, runnerOptions);
      await assert.rejects(prepare(f, runner, channel), expected);
      assert.deepEqual(runner.clones, []);
      assert.deepEqual(await readdir(f.output), []);
    });
  }
});

test("release output must be an existing empty external absolute directory without a symlink", async t => {
  const f = await fixture(t, "claude");
  const runner = builder(f);
  const internal = join(f.root, "output");
  await mkdir(internal);
  const linked = join(f.temporary, "linked");
  await symlink(f.output, linked);
  for (const [path, expected] of [["relative", /must be absolute/u], [internal, /outside the source repository/u], [linked, /non-symbolic-link/u]]) {
    await assert.rejects(prepare(f, runner, "stable", path), expected);
  }
  await writeFile(join(f.output, "existing"), "retain me\n");
  await assert.rejects(prepare(f, runner), /must be empty/u);
  assert.equal(await readFile(join(f.output, "existing"), "utf8"), "retain me\n");
  assert.deepEqual(runner.clones, []);
});

test("prepare arguments accept four Host products and forwarded separator without duplicate options", () => {
  for (const product of HOST_PRODUCTS) {
    assert.deepEqual(parseArguments(["--", "--product", product, "--output", "/tmp/output"]), { product, outputDirectory: "/tmp/output" });
  }
  for (const args of [[], ["--product", "taskbelay", "--output", "/tmp/output"], ["--product", "claude", "--product", "zcode", "--output", "/tmp/output"], ["--product", "claude", "--output"]]) {
    assert.throws(() => parseArguments(args), /usage:/u);
  }
});
