import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import { publishRelease, releasePresentation, verifyRegistryBytes } from "./publish.mjs";
import { validateReleaseArtifacts } from "./artifacts.mjs";

const packageName = "dev-flow-codex";
const version = "0.7.8";

for (const product of ["codex", "deepseek", "dev-flow"]) {
  test(`${product} accepts its current prepare format and retains recorded digests`, async t => {
    const fixture = await releaseFixture(t, product);
    const prepared = await validateReleaseArtifacts(fixture.selection);
    assert.deepEqual(prepared.manifest, fixture.manifest);
    assert.equal(prepared.tarball.sha256, fixture.manifest.artifacts[0].sha256);
    assert.equal(prepared.assets.length, product === "dev-flow" ? 3 : 5);
    for (const record of fixture.manifest.artifacts) {
      assert.equal(prepared.assets.find(asset => asset.name === record.relative_path).sha256, record.sha256);
    }
  });

  test(`${product} rejects a replaced tarball instead of adopting its current digest`, async t => {
    const fixture = await releaseFixture(t, product);
    await writeFile(fixture.tarball, "replacement package");
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /differs from recorded digest/);
  });

  test(`${product} rejects an altered SHA256SUMS declaration`, async t => {
    const fixture = await releaseFixture(t, product);
    const path = join(fixture.selection.directory, "SHA256SUMS");
    const original = await readFile(path, "utf8");
    await writeFile(path, original.replace(fixture.manifest.artifacts[0].sha256, "f".repeat(64)));
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /SHA256SUMS differs/);
  });
}

for (const product of ["codex", "deepseek"]) {
  for (const index of [1, 2]) test(`${product} rejects replaced Core artifact ${index}`, async t => {
    const fixture = await releaseFixture(t, product);
    await writeFile(join(fixture.selection.directory, fixture.manifest.artifacts[index].relative_path), "replacement Core");
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /differs from recorded digest/);
  });
}

test("artifact inventory rejects missing, duplicate, wrong-kind and unsafe paths", async t => {
  const cases = [
    ["missing", manifest => manifest.artifacts.pop(), /inventory is incomplete/],
    ["duplicate", manifest => { manifest.artifacts[1] = { ...manifest.artifacts[0] }; }, /duplicated/],
    ["wrong kind", manifest => { manifest.artifacts[0].kind = "core_binary"; }, /path\/kind/],
    ["parent path", manifest => { manifest.artifacts[0].relative_path = "../package.tgz"; }, /path\/kind/],
    ["absolute path", manifest => { manifest.artifacts[0].relative_path = "/tmp/package.tgz"; }, /path\/kind/],
    ["nested basename", manifest => { manifest.artifacts[0].relative_path = "nested/" + manifest.artifacts[0].relative_path; }, /path\/kind/],
    ["invalid digest", manifest => { manifest.artifacts[0].sha256 = "invalid"; }, /digest is invalid/],
  ];
  for (const [name, mutate, pattern] of cases) await t.test(name, async t => {
    const fixture = await releaseFixture(t, "codex");
    mutate(fixture.manifest);
    await writeFile(join(fixture.selection.directory, "release-manifest.json"), JSON.stringify(fixture.manifest));
    await assert.rejects(validateReleaseArtifacts(fixture.selection), pattern);
  });
});

test("prepared directory requires every declared file and no extra files", async t => {
  for (const missing of [true, false]) await t.test(missing ? "missing Core" : "extra file", async t => {
    const fixture = await releaseFixture(t, "deepseek");
    if (missing) await rm(join(fixture.selection.directory, fixture.manifest.artifacts[1].relative_path));
    else await writeFile(join(fixture.selection.directory, "unlisted.txt"), "unexpected");
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /exact prepared artifact set/);
  });
});

test("prepared files reject symbolic links and directories", async t => {
  for (const name of ["tarball", "core", "release-manifest.json", "SHA256SUMS"]) await t.test(name, async t => {
    const fixture = await releaseFixture(t, "codex");
    const selected = name === "tarball" ? fixture.manifest.artifacts[0].relative_path
      : name === "core" ? fixture.manifest.artifacts[1].relative_path : name;
    const path = join(fixture.selection.directory, selected), target = join(fixture.root, "outside");
    await rename(path, target); await symlink(target, path);
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /regular non-symbolic-link file/);
  });
  await t.test("directory", async t => {
    const fixture = await releaseFixture(t, "codex");
    await rm(fixture.tarball); await mkdir(fixture.tarball);
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /regular non-symbolic-link file/);
  });
});

test("checksums require unique complete entries and bind the Host manifest", async t => {
  for (const action of ["missing", "duplicate", "outside", "manifest"]) await t.test(action, async t => {
    const fixture = await releaseFixture(t, "codex");
    const path = join(fixture.selection.directory, "SHA256SUMS");
    const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
    if (action === "missing") lines.pop();
    if (action === "duplicate") lines.push(lines[0]);
    if (action === "outside") lines[0] = `${fixture.manifest.artifacts[0].sha256}  ../package.tgz`;
    if (action === "manifest") lines[lines.length - 1] = `${"f".repeat(64)}  release-manifest.json`;
    await writeFile(path, lines.join("\n") + "\n");
    await assert.rejects(validateReleaseArtifacts(fixture.selection), /SHA256SUMS/);
  });
});

test("release identity must match the selected product, version and source", async t => {
  const fixture = await releaseFixture(t, "codex");
  for (const selection of [{ product: "deepseek" }, { version: "9.9.9" }, { sourceCommit: "b".repeat(40) }]) {
    await assert.rejects(validateReleaseArtifacts({ ...fixture.selection, ...selection }), /identity mismatch/);
  }
});

for (const product of ["codex", "deepseek", "dev-flow"]) {
  test(`${product} publishes its complete verified artifact set and resumes matching remote state`, async t => {
    const fixture = await releaseFixture(t, product);
    const remote = fakeRemote(fixture);
    const result = await publishRelease({ ...fixture.selection, runProcess: remote.run });
    assert.equal(result.status, "complete");
    assert.deepEqual([...remote.assets.keys()].sort(), [...fixture.files.keys()].sort());
    for (const [name, bytes] of fixture.files) assert.deepEqual(remote.assets.get(name), bytes);
    const completedCalls = remote.calls.length;
    assert.equal((await publishRelease({ ...fixture.selection, runProcess: remote.run })).status, "complete");
    assert.equal(remote.calls.slice(completedCalls).some(({ command, args }) =>
      command === "git" && ["tag", "push"].includes(args[0])
      || command === "npm" && args[0] === "publish"
      || command === "gh" && ["create", "upload"].includes(args[1])), false);

    await writeFile(fixture.tarball, "changed after the completed release");
    const beforeRetry = remote.calls.length;
    await assert.rejects(publishRelease({ ...fixture.selection, runProcess: remote.run }), /differs from recorded digest/);
    assert.equal(remote.calls.length, beforeRetry);
  });

  test(`${product} rejects local corruption before any remote command`, async t => {
    for (const defect of ["tarball", "missing", "duplicate", "checksums"]) await t.test(defect, async t => {
      const fixture = await releaseFixture(t, product);
      if (defect === "tarball") await writeFile(fixture.tarball, "corrupt package");
      if (defect === "missing") await rm(fixture.tarball);
      if (defect === "duplicate") {
        fixture.manifest.artifacts.push({ ...fixture.manifest.artifacts[0] });
        await writeFile(join(fixture.selection.directory, "release-manifest.json"), JSON.stringify(fixture.manifest));
      }
      if (defect === "checksums") await writeFile(join(fixture.selection.directory, "SHA256SUMS"), "0".repeat(64) + "  missing.tgz\n");
      const calls = [];
      await assert.rejects(publishRelease({ ...fixture.selection, runProcess: async (...args) => { calls.push(args); throw new Error("unexpected remote call"); } }));
      assert.deepEqual(calls, []);
    });
  });
}

test("publisher refuses a replaced Core before creating Tag or npm state", async t => {
  const fixture = await releaseFixture(t, "codex");
  await writeFile(join(fixture.selection.directory, fixture.manifest.artifacts[1].relative_path), "corrupt Core");
  const calls = [];
  await assert.rejects(publishRelease({ ...fixture.selection, runProcess: async (...args) => { calls.push(args); throw new Error("unexpected remote call"); } }), /differs from recorded digest/);
  assert.deepEqual(calls, []);
});

test("an interrupted asset upload resumes without republishing matching immutable state", async t => {
  const fixture = await releaseFixture(t, "codex"), remote = fakeRemote(fixture);
  let interrupted = false;
  await assert.rejects(publishRelease({ ...fixture.selection, runProcess: async (command, args) => {
    const result = await remote.run(command, args);
    if (!interrupted && command === "gh" && args[1] === "upload") {
      interrupted = true;
      throw new Error("upload committed but response lost");
    }
    return result;
  } }), /response lost/);
  assert.equal(remote.assets.size, 1);
  assert.equal((await publishRelease({ ...fixture.selection, runProcess: remote.run })).status, "complete");
  assert.equal(remote.calls.filter(call => call.command === "npm" && call.args[0] === "publish").length, 1);
  assert.equal(remote.calls.filter(call => call.command === "git" && call.args[0] === "push").length, 1);
  assert.equal(remote.calls.filter(call => call.command === "gh" && call.args[1] === "create").length, 1);
  assert.equal(remote.calls.filter(call => call.command === "gh" && call.args[1] === "upload").length, fixture.files.size);
});

test("registry read-back keeps the recorded digest if local bytes change after preflight", async t => {
  const fixture = await releaseFixture(t, "codex"), remote = fakeRemote(fixture);
  let changed = false;
  await assert.rejects(publishRelease({ ...fixture.selection, runProcess: async (command, args) => {
    if (!changed) { changed = true; await writeFile(fixture.tarball, "changed after preflight"); }
    return remote.run(command, args);
  } }), /npm tarball read-back differs/);
  assert.equal(remote.calls.some(call => call.command === "npm" && call.args[0] === "publish"), true);
  assert.equal(remote.assets.size, 0);
});

test("GitHub read-back compares the saved expectation rather than changed local Core bytes", async t => {
  const fixture = await releaseFixture(t, "deepseek"), remote = fakeRemote(fixture);
  const coreName = fixture.manifest.artifacts[1].relative_path;
  await assert.rejects(publishRelease({ ...fixture.selection, runProcess: async (command, args) => {
    if (command === "gh" && args[1] === "view" && args.at(-1) === "assets,isDraft") {
      await writeFile(join(fixture.selection.directory, coreName), "changed after preflight");
    }
    return remote.run(command, args);
  } }), /GitHub asset .* differs from prepared artifact/);
  assert.notDeepEqual(remote.assets.get(coreName), fixture.files.get(coreName));
  assert.equal(remote.calls.some(call => call.command === "gh" && call.args[1] === "edit"), false);
});

test("release presentation names every product and links immutable release details", () => {
  const sourceCommit = "a".repeat(40);
  const coreVersion = "0.8.5";
  const cases = [
    { product: "codex", title: "Dev Flow for Codex v0.7.8", packageName: "dev-flow-codex", guidePath: "packages/codex/README.md", bundlesCore: true },
    { product: "deepseek", title: "Dev Flow for DeepSeek Harness v0.7.8", packageName: "dev-flow-deepseek", guidePath: "packages/deepseek/README.md", bundlesCore: true },
    { product: "dev-flow", title: "Dev Flow CLI v0.7.8", packageName: "@imotong/dev-flow", guidePath: "packages/dev-flow/README.md", bundlesCore: false },
  ];

  for (const item of cases) {
    const presentation = releasePresentation(item.product, version, {
      release: {
        product: item.product,
        version,
        source_commit: sourceCommit,
        ...(item.bundlesCore ? { core_version: coreVersion } : {}),
      },
    });
    assert.equal(presentation.title, item.title);
    assert.ok(presentation.notes.includes(`${item.packageName}@${version}`));
    assert.equal(presentation.notes.includes(`Dev Flow Core \`${coreVersion}\``), item.bundlesCore);
    assert.ok(presentation.notes.includes(`${sourceCommit}/${item.guidePath}`));
    assert.ok(presentation.notes.includes(`${sourceCommit}/docs/SUPPORT-MATRIX_en.md`));
    assert.ok(presentation.notes.includes(`tree/${sourceCommit}`));
    assert.ok(presentation.notes.includes("`SHA256SUMS`"));
    assert.equal(presentation.notes.includes("standalone Core binaries"), item.bundlesCore);
  }
});

test("registry tarball read-back retries ETARGET until npm pack can resolve the published version", async (t) => {
  const fixture = await tarballFixture(t, "expected package bytes\n");
  const waits = [];
  let calls = 0;
  await verifyRegistryBytes(packageName, version, fixture.sha256, {}, {
    timeoutMs: 20,
    pollMs: 5,
    wait: async (milliseconds) => waits.push(milliseconds),
    runProcess: async (command, arguments_) => {
      assertPackCommand(command, arguments_);
      calls += 1;
      if (calls <= 2) throw npmError("ETARGET", "npm error notarget No matching version found");
      return packFixture(arguments_, fixture.tarball);
    },
  });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [5, 5]);
});

test("registry tarball read-back stops after its bounded propagation window", async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    verifyRegistryBytes(packageName, version, "0".repeat(64), {}, {
      timeoutMs: 15,
      pollMs: 5,
      wait: async (milliseconds) => waits.push(milliseconds),
      runProcess: async () => {
        calls += 1;
        throw npmError("E404", "npm error 404 Not Found");
      },
    }),
    /bounded read-back window/u,
  );
  assert.equal(calls, 3);
  assert.deepEqual(waits, [5, 5]);
});

test("registry tarball read-back does not retry authentication or byte conflicts", async (t) => {
  const fixture = await tarballFixture(t, "expected package bytes\n");
  let authenticationCalls = 0;
  await assert.rejects(
    verifyRegistryBytes(packageName, version, fixture.sha256, {}, {
      timeoutMs: 20,
      pollMs: 5,
      wait: async () => assert.fail("authentication failure must not wait"),
      runProcess: async () => {
        authenticationCalls += 1;
        throw npmError("E401", "npm error authentication required");
      },
    }),
    /npm pack failed/u,
  );
  assert.equal(authenticationCalls, 1);

  let byteCalls = 0;
  await assert.rejects(
    verifyRegistryBytes(packageName, version, fixture.sha256, {}, {
      timeoutMs: 20,
      pollMs: 5,
      wait: async () => assert.fail("byte conflict must not wait"),
      runProcess: async (command, arguments_) => {
        assertPackCommand(command, arguments_);
        byteCalls += 1;
        const corrupt = join(fixture.root, "corrupt.tgz");
        await writeFile(corrupt, "different package bytes\n");
        return packFixture(arguments_, corrupt);
      },
    }),
    /differs from local artifact/u,
  );
  assert.equal(byteCalls, 1);
});

async function tarballFixture(t, contents) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-publish-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tarball = join(root, `dev-flow-codex-${version}.tgz`);
  await writeFile(tarball, contents);
  return { root, tarball, sha256: createHash("sha256").update(contents).digest("hex") };
}

function assertPackCommand(command, arguments_) {
  assert.equal(command, "npm");
  assert.equal(arguments_[0], "pack");
  assert.equal(arguments_[1], `${packageName}@${version}`);
  assert.ok(arguments_.includes("--ignore-scripts"));
  assert.ok(arguments_.includes("--registry=https://registry.npmjs.org/"));
}

async function packFixture(arguments_, source) {
  const destination = arguments_[arguments_.indexOf("--pack-destination") + 1];
  const filename = `dev-flow-codex-${version}.tgz`;
  await copyFile(source, join(destination, filename));
  return JSON.stringify([{ filename }]);
}

function npmError(code, stderr) {
  const error = new Error("npm pack failed");
  error.code = code;
  error.stderr = stderr;
  return error;
}

async function releaseFixture(t, product) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-publisher-artifacts-")), directory = join(root, "prepared");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(directory);
  const sourceCommit = "a".repeat(40), coreVersion = "0.8.5", bundlesCore = product !== "dev-flow";
  const tarballName = `${bundlesCore ? `dev-flow-${product}` : "imotong-dev-flow"}-${version}.tgz`;
  const names = [tarballName, ...(bundlesCore ? [`dev-flow-core-${coreVersion}-darwin-arm64`, `dev-flow-core-${coreVersion}-windows-amd64.exe`] : [])];
  const files = new Map(names.map(name => [name, Buffer.from(`prepared ${name}\n`)]));
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  const artifacts = names.map((name, index) => ({ kind: index === 0 ? "npm_tarball" : "core_binary", relative_path: name, sha256: digest(files.get(name)) }));
  const manifest = {
    release: { product, version, source_commit: sourceCommit, ...(bundlesCore ? { core_version: coreVersion, source_tree: "b".repeat(40) } : {}) },
    artifacts,
    ...(bundlesCore ? {} : { desktop_applications: { "darwin-arm64": { signing: "ad-hoc" }, "win32-x64": { signing: "unsigned" } } }),
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  files.set("release-manifest.json", manifestBytes);
  const sums = artifacts.map(item => `${item.sha256}  ${item.relative_path}`);
  if (bundlesCore) sums.push(`${digest(manifestBytes)}  release-manifest.json`);
  files.set("SHA256SUMS", Buffer.from(sums.join("\n") + "\n"));
  for (const [name, bytes] of files) await writeFile(join(directory, name), bytes);
  return { root, selection: { product, version, sourceCommit, directory }, manifest, files, tarball: join(directory, tarballName) };
}

function fakeRemote(fixture) {
  const calls = [], assets = new Map();
  let tagged = false, release = null, npmBytes = null;
  const run = async (command, args) => {
    calls.push({ command, args });
    if (command === "git") {
      if (args[0] === "ls-remote") return tagged ? `${fixture.selection.sourceCommit}\t${args.at(-1)}` : "";
      if (args[0] === "tag") return "";
      if (args[0] === "push") { tagged = true; return ""; }
    }
    if (command === "npm") {
      if (args[0] === "view") {
        if (!npmBytes) throw new Error("version absent");
        return JSON.stringify(version);
      }
      if (args[0] === "publish") { npmBytes = await readFile(args[1]); return ""; }
      if (args[0] === "pack") {
        assert.ok(npmBytes);
        const filename = basename(fixture.tarball), destination = args[args.indexOf("--pack-destination") + 1];
        await writeFile(join(destination, filename), npmBytes);
        return JSON.stringify([{ filename }]);
      }
    }
    if (command === "gh" && args[0] === "release") {
      if (args[1] === "view") {
        if (!release) throw new Error("release absent");
        return JSON.stringify({ ...release, assets: [...assets.keys()].map(name => ({ name })) });
      }
      if (args[1] === "create") { release = { tagName: args[2], targetCommitish: fixture.selection.sourceCommit, isDraft: true }; return ""; }
      if (args[1] === "upload") { assets.set(basename(args[3]), await readFile(args[3])); return ""; }
      if (args[1] === "download") {
        const name = args[args.indexOf("--pattern") + 1], directory = args[args.indexOf("--dir") + 1];
        assert.ok(assets.has(name));
        await writeFile(join(directory, name), assets.get(name)); return "";
      }
      if (args[1] === "edit") { release.isDraft = false; return ""; }
    }
    throw new Error(`unexpected fake command: ${command} ${args.join(" ")}`);
  };
  return { run, calls, assets };
}
