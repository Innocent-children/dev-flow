import assert from "node:assert/strict";
import { chmod, lstat, mkdir, readFile, readdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CODEX_COMPATIBILITY_RANGE,
  digestResources,
  readReceipt,
  receiptOwnershipMatches,
  runCodexJSON,
  validateReceipt,
  versionSatisfiesRange,
  writeReceiptAtomic,
} from "../lib/lifecycle.mjs";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const receiptSchemaPath = join(
  repositoryRoot,
  "specs",
  "003-codex-explicit-dev-flow",
  "contracts",
  "registration-receipt.schema.json",
);
const fakeCodexPath = fileURLToPath(new URL("./fixtures/fake-codex.mjs", import.meta.url));

test("receipt parser enforces the checked-in closed schema", async (t) => {
  const root = await makeRoot(t);
  const schema = JSON.parse(await readFile(receiptSchemaPath, "utf8"));
  assert.equal(schema.additionalProperties, false);
  for (const field of ["product", "host", "registration", "paths", "resource_digests"]) {
    assert.equal(schema.properties[field].additionalProperties, false, `${field} must remain closed`);
  }

  const receipt = validReceipt(root);
  assert.deepEqual(validateReceipt(receipt), receipt);
  assert.throws(() => validateReceipt({ ...receipt, unexpected: true }), /unexpected field.*unexpected/);
  assert.throws(
    () => validateReceipt({ ...receipt, product: { ...receipt.product, projection: "forbidden" } }),
    /product.*unexpected field.*projection/,
  );
});

test("receipt validation uses the selected dynamic compatibility range", async (t) => {
  const root = await makeRoot(t);
  assert.equal(versionSatisfiesRange("0.147.0", CODEX_COMPATIBILITY_RANGE), true);
  assert.equal(versionSatisfiesRange("0.147.99", CODEX_COMPATIBILITY_RANGE), true);
  assert.equal(versionSatisfiesRange("0.148.0", CODEX_COMPATIBILITY_RANGE), false);
  assert.equal(versionSatisfiesRange("0.146.9", CODEX_COMPATIBILITY_RANGE), false);

  const outsideRange = validReceipt(root);
  outsideRange.host.version = "0.148.0";
  assert.throws(() => validateReceipt(outsideRange), /does not satisfy/);

  const staleRange = validReceipt(root);
  staleRange.product.codex_compatibility = ">=0.146.0 <0.147.0";
  assert.throws(() => validateReceipt(staleRange), /compatibility range/);
});

test("resource digests are lowercase SHA-256 values bound into the receipt", async (t) => {
  const root = await makeRoot(t);
  const resources = {
    pluginManifest: join(root, "plugin.json"),
    skill: join(root, "SKILL.md"),
    mcpConfiguration: join(root, ".mcp.json"),
  };
  await writeFile(resources.pluginManifest, "plugin\n");
  await writeFile(resources.skill, "skill\n");
  await writeFile(resources.mcpConfiguration, "mcp\n");

  const digests = await digestResources(resources);
  assert.deepEqual(Object.keys(digests).sort(), ["mcp_configuration", "plugin_manifest", "skill"]);
  for (const digest of Object.values(digests)) assert.match(digest, /^[0-9a-f]{64}$/);

  const receipt = validReceipt(root);
  receipt.resource_digests = digests;
  validateReceipt(receipt);
  receipt.resource_digests.skill = digests.skill.toUpperCase();
  assert.throws(() => validateReceipt(receipt), /resource_digests.skill/);
});

test("atomic receipt writes are read back without disturbing adjacent files", async (t) => {
  const root = await makeRoot(t);
  const ownedRoot = join(root, "product-data");
  const receiptPath = join(ownedRoot, "registrations", "codex.json");
  const adjacentPath = join(ownedRoot, "registrations", "user-note.txt");
  await mkdir(dirname(adjacentPath), { recursive: true });
  await writeFile(adjacentPath, "preserve\n");
  const receipt = validReceipt(root, { receiptPath });

  await writeReceiptAtomic(receiptPath, receipt, { ownedRoot });
  assert.deepEqual(await readReceipt(receiptPath), receipt);
  assert.equal(await readFile(adjacentPath, "utf8"), "preserve\n");
  assert.equal((await lstat(receiptPath)).mode & 0o777, 0o600);
  assert.deepEqual(
    (await readdir(dirname(receiptPath))).filter((name) => name.includes(".tmp-")),
    [],
  );
});

test("receipt writes reject a symlink escape before writing", async (t) => {
  const root = await makeRoot(t);
  const ownedRoot = join(root, "product-data");
  const outside = join(root, "outside");
  await mkdir(ownedRoot, { recursive: true });
  await mkdir(outside, { recursive: true });
  await symlink(outside, join(ownedRoot, "registrations"));
  const receiptPath = join(ownedRoot, "registrations", "codex.json");

  await assert.rejects(
    writeReceiptAtomic(receiptPath, validReceipt(root, { receiptPath }), { ownedRoot }),
    /symbolic link/,
  );
  await assert.rejects(readFile(join(outside, "codex.json")), { code: "ENOENT" });
});

test("missing receipt is absent while malformed and incomplete receipts fail closed", async (t) => {
  const root = await makeRoot(t);
  const receiptPath = join(root, "registrations", "codex.json");
  assert.equal(await readReceipt(receiptPath), null);

  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, "{not-json\n");
  await assert.rejects(readReceipt(receiptPath), /parse registration receipt/);

  await writeFile(receiptPath, "{}\n");
  await assert.rejects(readReceipt(receiptPath), /registration receipt.*missing field/);
});

test("ownership comparison is exact for owned identity and ignores only installation time", async (t) => {
  const root = await makeRoot(t);
  const receipt = validReceipt(root);
  const sameOwnership = structuredClone(receipt);
  sameOwnership.installed_at = "2026-08-15T01:02:03.000Z";
  assert.equal(receiptOwnershipMatches(receipt, sameOwnership), true);

  for (const mutate of [
    (value) => (value.product.version = "0.1.1"),
    (value) => (value.registration.plugin_root = join(root, "other-plugin")),
    (value) => (value.paths.data_dir = join(root, "other-data")),
    (value) => (value.resource_digests.skill = "d".repeat(64)),
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    assert.equal(receiptOwnershipMatches(receipt, changed), false);
  }
});

test("Codex JSON invocation is argv-closed, traced, and fails on malformed output", async (t) => {
  const root = await makeRoot(t);
  const statePath = join(root, "fake-state.json");
  const tracePath = join(root, "fake-trace.jsonl");
  const environment = {
    ...process.env,
    FAKE_CODEX_STATE: statePath,
    FAKE_CODEX_TRACE: tracePath,
    FAKE_CODEX_VERSION: "0.147.0",
  };

  assert.deepEqual(
    await runCodexJSON(["plugin", "marketplace", "list", "--json"], {
      codexExecutable: fakeCodexPath,
      environment,
    }),
    [],
  );
  const traces = (await readFile(tracePath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(traces[0].argv, ["plugin", "marketplace", "list", "--json"]);

  const malformed = join(root, "malformed-codex");
  await writeFile(malformed, "#!/bin/sh\nprintf 'not-json\\n'\n", { mode: 0o700 });
  await chmod(malformed, 0o700);
  await assert.rejects(
    runCodexJSON(["plugin", "list", "--json"], { codexExecutable: malformed, environment }),
    /valid JSON/,
  );
});

async function makeRoot(t) {
  const { mkdtemp } = await import("node:fs/promises");
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-lifecycle-")));
  t.after(async () => {});
  return root;
}

function validReceipt(root, { receiptPath = join(root, "registrations", "codex.json") } = {}) {
  return {
    schema_version: 2,
    product: {
      name: "dev-flow-codex",
      version: "0.1.0",
      core_version: "0.1.0",
      codex_compatibility: CODEX_COMPATIBILITY_RANGE,
    },
    host: { surface: "codex-cli", version: "0.147.0", os: "darwin", arch: "arm64" },
    registration: {
      marketplace_name: "dev-flow-local",
      marketplace_root: root,
      plugin_name: "dev-flow-codex",
      plugin_selector: "dev-flow-codex@dev-flow-local",
      plugin_root: join(root, "plugin"),
    },
    paths: {
      package_root: root,
      runtime_path: join(root, "runtime", "darwin-arm64", "dev-flow"),
      data_dir: join(root, "data"),
      receipt_path: receiptPath,
    },
    resource_digests: {
      plugin_manifest: "a".repeat(64),
      skill: "b".repeat(64),
      mcp_configuration: "c".repeat(64),
    },
    installed_at: "2026-08-15T00:00:00.000Z",
  };
}
