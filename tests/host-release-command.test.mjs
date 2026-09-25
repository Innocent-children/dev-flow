import assert from "node:assert/strict";
import { execFile as callback } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { runHostReleaseCommand, parseHostReleaseArguments } from "../release/host-command.mjs";
import { hostVersionPaths, readHostVersion } from "../release/host-versions.mjs";
import { prepareRelease } from "../release/prepare.mjs";

const execFile = promisify(callback);
const hosts = ["codex", "deepseek", "claude", "zcode"];
const coreVersion = "1.2.3";
const runGit = async (root, args) => (await execFile("git", args, { cwd: root })).stdout.trim();
const readJSON = async path => JSON.parse(await readFile(path, "utf8"));
async function writeJSON(path, value) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

test("all four release entrypoints keep their selected product and explicit confirmation", async () => {
  for (const product of hosts) {
    const entry = await import(`../scripts/release-${product}.mjs`);
    const input = ["--", "--version", "0.1.0", "--confirm", `${product}-v0.1.0`];
    assert.deepEqual(entry.parseReleaseArguments(input), parseHostReleaseArguments(product, input));
    await assert.rejects(entry.runReleaseCommand({ targetVersion: "0.1.0", confirmation: "wrong" }), /confirmation must equal/);
    await assert.rejects(entry.runReleaseCommand({ targetVersion: "0.1.0", confirmation: `${product}-v0.1.0`, platform: "win32" }), /requires darwin-arm64/);
  }
  assert.throws(() => parseHostReleaseArguments("claude", ["--version", "--confirm", "x"]), /missing value/);
  assert.throws(() => parseHostReleaseArguments("claude", ["--version", "0.1.0", "--version", "0.2.0"]), /only once/);
});

for (const product of hosts) {
  test(`${product} first stable release records the current package version without a previous Tag`, async t => {
    const fixture = await makeFixture(t, product);
    const originalMetadata = await readJSON(join(fixture.root, "release/public-versions.json"));
    const result = await runHostReleaseCommand(fixture.options);
    assert.equal(result.product, product);
    assert.equal(result.tag, `${product}-v0.1.0`);
    assert.equal(result.mode, "prepared-and-published");
    assert.equal(result.output_files.length, 5);
    assert.equal(await runGit(fixture.root, ["tag", "--list"]), "");
    assert.notEqual(result.source_commit, fixture.initialCommit);
    assert.equal(await runGit(fixture.root, ["diff", "--name-only", `${fixture.initialCommit}..HEAD`]), "release/public-versions.json");
    assert.deepEqual(await readJSON(join(fixture.root, "release/public-versions.json")), {
      ...originalMetadata, core_version: coreVersion, [product]: { version: "0.1.0", core_version: coreVersion },
    });
    assert.equal(fixture.calls[0].kind, "checks");
    assert.equal(fixture.calls[1].kind, "build");
    assert.equal(fixture.calls[2].kind, "publish");
    assert.equal(fixture.calls[0].head, fixture.initialCommit);
    assert.equal(fixture.calls[2].source, result.source_commit);
    assert.equal(await runGit(fixture.root, ["status", "--porcelain"]), "");
    assert.equal(await runGit(fixture.root, ["rev-parse", "origin/main"]), result.source_commit);
  });

  test(`${product} beta release updates all version mirrors and preserves stable records`, async t => {
    const fixture = await makeFixture(t, product, { channel: "beta", targetVersion: "0.2.0-beta.1" });
    const originalMetadata = await readFile(join(fixture.root, "release/public-versions.json"), "utf8");
    const result = await runHostReleaseCommand(fixture.options);
    assert.equal(result.release_channel, "beta");
    assert.equal(await readHostVersion(fixture.root, product), "0.2.0-beta.1");
    assert.equal(await readFile(join(fixture.root, "release/public-versions.json"), "utf8"), originalMetadata);
    assert.deepEqual((await runGit(fixture.root, ["diff", "--name-only", `${fixture.initialCommit}..HEAD`])).split("\n").sort(), hostVersionPaths(product).sort());
    assert.equal(await runGit(fixture.root, ["rev-parse", "origin/topic"]), result.source_commit);
    for (const other of hosts.filter(host => host !== product)) assert.equal(await readHostVersion(fixture.root, other), "0.1.0");
  });
}

for (const product of ["claude", "zcode"]) {
  test(`${product} stable upgrade aligns package and plugin identities before preparing`, async t => {
    const fixture = await makeFixture(t, product, { targetVersion: "0.2.0" });
    await runHostReleaseCommand(fixture.options);
    assert.equal(await readHostVersion(fixture.root, product), "0.2.0");
    assert.deepEqual((await runGit(fixture.root, ["diff", "--name-only", `${fixture.initialCommit}..HEAD`])).split("\n").sort(),
      [...hostVersionPaths(product), "release/public-versions.json"].sort());
    assert.equal(fixture.calls[1].version, "0.2.0");
  });

  test(`${product} retries the saved release after source advances without another version commit or build`, async t => {
    const fixture = await makeFixture(t, product, { failPublish: true });
    await assert.rejects(runHostReleaseCommand(fixture.options), /simulated publication failure/);
    const preparedCommit = await runGit(fixture.root, ["rev-parse", "HEAD"]);
    await writeFile(join(fixture.root, "later.txt"), "later source\n");
    await runGit(fixture.root, ["add", "."]);
    await runGit(fixture.root, ["commit", "-m", "later source"]);
    await runGit(fixture.root, ["push", "origin", "main"]);
    const currentCommit = await runGit(fixture.root, ["rev-parse", "HEAD"]);
    fixture.failPublish = false;
    const result = await runHostReleaseCommand(fixture.options);
    assert.equal(result.mode, "resumed-and-published");
    assert.equal(result.source_commit, preparedCommit);
    assert.equal(await runGit(fixture.root, ["rev-parse", "HEAD"]), currentCommit);
    assert.deepEqual(fixture.calls.map(call => call.kind), ["checks", "build", "publish", "publish"]);
    assert.equal(fixture.calls.at(-1).source, preparedCommit);
  });
}

test("failed fixed checks leave release version files untouched", async t => {
  const fixture = await makeFixture(t, "zcode", { targetVersion: "0.2.0", failChecks: true });
  await assert.rejects(runHostReleaseCommand(fixture.options), /simulated check failure/);
  assert.equal(await runGit(fixture.root, ["rev-parse", "HEAD"]), fixture.initialCommit);
  assert.equal(await runGit(fixture.root, ["status", "--porcelain"]), "");
  assert.equal(await readHostVersion(fixture.root, "zcode"), "0.1.0");
  assert.deepEqual(fixture.calls.map(call => call.kind), ["checks"]);
});

test("resume rejects changed bytes and another product before dispatching any release process", async t => {
  const fixture = await makeFixture(t, "claude");
  await runHostReleaseCommand(fixture.options);
  const calls = fixture.calls.length;
  await assert.rejects(runHostReleaseCommand({ ...fixture.options, product: "zcode", confirmation: "zcode-v0.1.0" }), /manifest identity mismatch/);
  await writeFile(join(fixture.output, "taskbelay-claude-0.1.0.tgz"), "changed bytes");
  await assert.rejects(runHostReleaseCommand(fixture.options), /differs from recorded digest/);
  assert.equal(fixture.calls.length, calls);
});

test("source and version guards stop before version changes or builds", async t => {
  const fixture = await makeFixture(t, "zcode");
  await assert.rejects(runHostReleaseCommand({ ...fixture.options, targetVersion: "0.0.9", confirmation: "zcode-v0.0.9" }), /must be greater/);
  await assert.rejects(runHostReleaseCommand({ ...fixture.options, outputDirectory: join(fixture.root, "output") }), /outside the source/);
  await writeFile(join(fixture.root, "dirty.txt"), "dirty\n");
  await assert.rejects(runHostReleaseCommand(fixture.options), /clean source checkout/);
  assert.equal(fixture.calls.length, 0);
  assert.equal(await runGit(fixture.root, ["rev-parse", "HEAD"]), fixture.initialCommit);
});

async function makeFixture(t, product, { channel = "stable", targetVersion = "0.1.0", failPublish = false, failChecks = false } = {}) {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "taskbelay-host-release-")));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, "source"), remote = join(temporary, "remote.git"), output = join(temporary, "output");
  await mkdir(root);
  await mkdir(output);
  await execFile("git", ["init", "--bare", remote]);
  await runGit(root, ["init", "-b", channel === "stable" ? "main" : "topic"]);
  await runGit(root, ["config", "user.name", "Release contract test"]);
  await runGit(root, ["config", "user.email", "release-test@example.invalid"]);
  await runGit(root, ["config", "commit.gpgsign", "false"]);
  for (const host of hosts) {
    for (const path of hostVersionPaths(host)) {
      const manifest = { name: `taskbelay-${host}`, version: "0.1.0" };
      await writeJSON(join(root, path), path.endsWith("/marketplace.json")
        ? { name: "taskbelay-zcode-local", plugins: [manifest] } : manifest);
    }
  }
  await writeFile(join(root, "CORE_VERSION"), `${coreVersion}\n`);
  await writeJSON(join(root, "release/public-versions.json"), {
    core_version: "1.0.0", codex: { version: "0.0.1", core_version: "1.0.0" }, deepseek: { version: "0.0.1", core_version: "1.0.0" },
  });
  await runGit(root, ["add", "."]);
  await runGit(root, ["commit", "-m", "fixture"]);
  await runGit(root, ["remote", "add", "origin", remote]);
  await runGit(root, ["push", "-u", "origin", channel === "stable" ? "main" : "topic"]);
  const fixture = { root, output, temporary, calls: [], failPublish, initialCommit: await runGit(root, ["rev-parse", "HEAD"]) };
  fixture.options = {
    product, channel, targetVersion, confirmation: `${product}-v${targetVersion}`, repositoryRoot: root,
    outputDirectory: output, platform: "darwin", architecture: "arm64",
    runProcess: async (executable, args, options) => {
      assert.equal(executable, process.execPath);
      assert.equal(options.cwd, root);
      assert.equal(options.env.TASKBELAY_RELEASE_CHANNEL, channel);
      if (args[0] === "--test") {
        fixture.calls.push({ kind: "checks", head: await runGit(root, ["rev-parse", "HEAD"]) });
        assert.ok(args.includes(`packages/${product}/tests/${["codex", "deepseek"].includes(product) ? "package-contract" : "package"}.test.mjs`));
        if (failChecks) throw new Error("simulated check failure");
      } else if (basename(args[0]) === "build-host-release.mjs") {
        assert.deepEqual(args.slice(1), ["--product", product, "--output", output]);
        fixture.calls.push({ kind: "build", version: await readHostVersion(root, product) });
        const coreRoot = join(temporary, "tar", "package/runtime");
        for (const [runtime, binary] of [["darwin-arm64", "taskbelay"], ["win32-x64", "taskbelay.exe"]]) {
          await mkdir(join(coreRoot, runtime), { recursive: true });
          await writeFile(join(coreRoot, runtime, binary), `fixture ${runtime}`);
        }
        const tarball = join(temporary, "fixture.tgz");
        await execFile("tar", ["-czf", tarball, "-C", join(temporary, "tar"), "package"]);
        await prepareRelease({ product, repositoryRoot: root, sourceCommit: await runGit(root, ["rev-parse", "HEAD"]),
          sourceTree: await runGit(root, ["rev-parse", "HEAD^{tree}"]), firstTarball: tarball, secondTarball: tarball, outputDirectory: output });
      } else if (basename(args[0]) === "publish.mjs") {
        fixture.calls.push({ kind: "publish", source: args[args.indexOf("--source") + 1] });
        assert.deepEqual(args.slice(1, 7), ["--product", product, "--version", targetVersion, "--directory", output]);
        if (fixture.failPublish) throw new Error("simulated publication failure");
      } else {
        assert.fail(`unexpected process ${args.join(" ")}`);
      }
    },
  };
  return fixture;
}
