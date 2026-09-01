import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { releaseAssetNames, verifyRegistryBytes } from "./publish.mjs";

const packageName = "dev-flow-codex";
const version = "0.7.8";

test("release assets retain both supported standalone Core binaries", () => {
  assert.deepEqual(releaseAssetNames(`dev-flow-codex-${version}.tgz`, {
    artifacts: [
      { kind: "npm_tarball", relative_path: `dev-flow-codex-${version}.tgz` },
      { kind: "core_binary", relative_path: "dev-flow-core-0.8.5-darwin-arm64" },
      { kind: "core_binary", relative_path: "dev-flow-core-0.8.5-windows-amd64.exe" },
    ],
  }), [
    `dev-flow-codex-${version}.tgz`,
    "dev-flow-core-0.8.5-darwin-arm64",
    "dev-flow-core-0.8.5-windows-amd64.exe",
    "release-manifest.json",
    "SHA256SUMS",
  ]);
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
