import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CODEX_COMPATIBILITY_RANGE,
  digestResources,
  readReceipt,
  receiptOwnershipMatches,
  removeRegistration,
  runCodexJSON,
  setupRegistration,
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
  assert.equal(schema.properties.schema_version.const, 3);
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
    skillMetadata: join(root, "openai.yaml"),
    mcpConfiguration: join(root, ".mcp.json"),
  };
  await writeFile(resources.pluginManifest, "plugin\n");
  await writeFile(resources.skill, "skill\n");
  await writeFile(resources.skillMetadata, "policy\n");
  await writeFile(resources.mcpConfiguration, "mcp\n");

  const digests = await digestResources(resources);
  assert.deepEqual(Object.keys(digests).sort(), [
    "mcp_configuration",
    "plugin_manifest",
    "skill",
    "skill_metadata",
  ]);
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
    { marketplaces: [] },
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

test("setup preflights compatibility, resources, runtime, and PATH before registration writes", async (t) => {
  const incompatible = await makeSetupFixture(t, "incompatible");
  incompatible.environment.FAKE_CODEX_VERSION = "0.146.9";
  await assert.rejects(setupRegistration(incompatible.options), /does not satisfy/);
  await assert.rejects(stat(incompatible.statePath), { code: "ENOENT" });
  await assert.rejects(stat(incompatible.paths.receiptPath), { code: "ENOENT" });

  const missingSkill = await makeSetupFixture(t, "missing-skill");
  await writeFile(join(missingSkill.paths.pluginRoot, "skills", "dev-flow", "SKILL.md"), "");
  await assert.rejects(setupRegistration(missingSkill.options), /Skill.*non-empty/);
  await assert.rejects(stat(missingSkill.statePath), { code: "ENOENT" });

  const wrongSkillPolicy = await makeSetupFixture(t, "wrong-skill-policy");
  await writeFile(
    join(wrongSkillPolicy.paths.pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"),
    "policy:\n  allow_implicit_invocation: true\n",
  );
  await assert.rejects(setupRegistration(wrongSkillPolicy.options), /explicit-only Skill policy/);
  await assert.rejects(stat(wrongSkillPolicy.statePath), { code: "ENOENT" });

  const wrongMcp = await makeSetupFixture(t, "wrong-mcp-shape");
  await writeFile(
    join(wrongMcp.paths.pluginRoot, ".mcp.json"),
    `${JSON.stringify({ mcpServers: { "dev-flow": { command: "dev-flow-codex", args: ["mcp"] } } })}\n`,
  );
  await assert.rejects(
    setupRegistration(wrongMcp.options),
    /MCP configuration missing field \$schema/,
  );
  await assert.rejects(stat(wrongMcp.statePath), { code: "ENOENT" });

  const missingPath = await makeSetupFixture(t, "missing-path");
  missingPath.options.environment = { ...missingPath.environment, PATH: join(missingPath.root, "empty-bin") };
  await assert.rejects(setupRegistration(missingPath.options), /dev-flow-codex.*PATH/);
  await assert.rejects(stat(missingPath.statePath), { code: "ENOENT" });

  const wrongPath = await makeSetupFixture(t, "wrong-path");
  const wrongBin = join(wrongPath.root, "wrong-bin");
  await mkdir(wrongBin, { recursive: true });
  await writeFile(join(wrongBin, "dev-flow-codex"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  wrongPath.options.environment = { ...wrongPath.environment, PATH: wrongBin };
  await assert.rejects(setupRegistration(wrongPath.options), /does not resolve to this installed package/);
  await assert.rejects(stat(wrongPath.statePath), { code: "ENOENT" });

  const nonExecutable = await makeSetupFixture(t, "non-executable");
  await chmod(nonExecutable.paths.runtimePath, 0o600);
  await assert.rejects(setupRegistration(nonExecutable.options), /packaged Core.*executable/);
  await assert.rejects(stat(nonExecutable.statePath), { code: "ENOENT" });
});

test("setup registers through exact JSON commands, verifies readback, and writes the receipt last", async (t) => {
  const fixture = await makeSetupFixture(t, "successful");
  const repository = join(fixture.root, "target repository-仓库");
  await mkdir(repository, { recursive: true });
  await writeFile(join(repository, "owned.txt"), "unchanged\n");
  const before = await directoryFingerprint(repository);
  fixture.options.currentDirectory = repository;

  const result = await setupRegistration(fixture.options);
  assert.equal(result.status, "installed");
  assert.equal(result.changed, true);
  assert.equal(result.receipt.paths.receipt_path, fixture.paths.receiptPath);
  assert.equal(await directoryFingerprint(repository), before);

  const receipt = await readReceipt(fixture.paths.receiptPath);
  assert.equal(receipt.product.version, "0.1.0");
  assert.equal(receipt.product.core_version, "0.1.0");
  assert.equal(receipt.host.version, "0.147.0");

  const state = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.equal(state.marketplaces.length, 1);
  assert.equal(state.plugins.length, 1);
  assert.equal(state.marketplaces[0].root, fixture.paths.marketplaceRoot);
  assert.equal(state.marketplaces[0].marketplaceSource.source, fixture.paths.marketplaceRoot);
  assert.equal(state.plugins[0].pluginId, "dev-flow-codex@dev-flow-local");
  assert.equal(state.plugins[0].marketplaceName, "dev-flow-local");
  assert.equal(state.plugins[0].source.path, fixture.paths.pluginRoot);

  const traces = await readTrace(fixture.tracePath);
  assert.deepEqual(
    traces.map((entry) => entry.argv),
    [
      ["--version"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "list", "--json"],
      ["plugin", "marketplace", "add", fixture.paths.marketplaceRoot, "--json"],
      ["plugin", "add", "dev-flow-codex@dev-flow-local", "--json"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "list", "--json"],
    ],
  );
  assert.equal(traces.every((entry) => entry.cwd === fixture.paths.packageRoot), true);
});

test("matching repeated setup is a no-op while receipt or readback conflicts fail closed", async (t) => {
  const fixture = await makeSetupFixture(t, "repeat");
  await setupRegistration(fixture.options);
  const receiptBefore = await readFile(fixture.paths.receiptPath, "utf8");
  const stateBefore = await readFile(fixture.statePath, "utf8");

  const repeated = await setupRegistration(fixture.options);
  assert.equal(repeated.status, "already-installed");
  assert.equal(repeated.changed, false);
  assert.equal(await readFile(fixture.paths.receiptPath, "utf8"), receiptBefore);
  assert.equal(await readFile(fixture.statePath, "utf8"), stateBefore);

  const conflictingReceipt = JSON.parse(receiptBefore);
  conflictingReceipt.registration.plugin_root = join(fixture.root, "different-plugin");
  await writeFile(fixture.paths.receiptPath, `${JSON.stringify(conflictingReceipt)}\n`);
  await assert.rejects(setupRegistration(fixture.options), /receipt.*conflict/i);
  assert.equal(await readFile(fixture.statePath, "utf8"), stateBefore);

  const orphan = await makeSetupFixture(t, "orphan-state");
  await mkdir(dirname(orphan.statePath), { recursive: true });
  await writeFile(
    orphan.statePath,
    `${JSON.stringify({
      marketplaces: [marketplaceStateEntry("dev-flow-local", "/unexpected")],
      plugins: [],
    })}\n`,
  );
  await assert.rejects(setupRegistration(orphan.options), /marketplace.*conflict/i);
  assert.equal(
    await readFile(orphan.statePath, "utf8"),
    `${JSON.stringify({
      marketplaces: [marketplaceStateEntry("dev-flow-local", "/unexpected")],
      plugins: [],
    })}\n`,
  );
});

test("setup rolls back only a marketplace created by the failing attempt", async (t) => {
  const fixture = await makeSetupFixture(t, "rollback");
  fixture.options.environment = {
    ...fixture.environment,
    FAKE_CODEX_FAIL: "add:dev-flow-codex@dev-flow-local",
  };

  await assert.rejects(setupRegistration(fixture.options), /Codex command failed/);
  const state = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.deepEqual(state.marketplaces, []);
  assert.deepEqual(state.plugins, []);
  await assert.rejects(stat(fixture.paths.receiptPath), { code: "ENOENT" });
  const calls = (await readTrace(fixture.tracePath)).map((entry) => entry.argv.join(" "));
  assert.equal(calls.includes("plugin marketplace remove dev-flow-local --json"), true);
});

test("setup does not roll back a marketplace concurrently added by another owner", async (t) => {
  const fixture = await makeSetupFixture(t, "concurrent-marketplace-add");
  const concurrentCodex = join(fixture.root, "concurrent-codex.mjs");
  await writeFile(concurrentCodex, `#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
if (argv[0] === "plugin" && argv[1] === "marketplace" && argv[2] === "add") {
  const root = resolve(argv[3]);
  const catalog = JSON.parse(await readFile(resolve(root, ".agents/plugins/marketplace.json"), "utf8"));
  const statePath = process.env.FAKE_CODEX_STATE;
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({
    marketplaces: [{
      name: catalog.name,
      root,
      marketplaceSource: { sourceType: "local", source: root },
    }],
    plugins: [],
  }));
}
const child = spawn(${JSON.stringify(fakeCodexPath)}, argv, { env: process.env, stdio: "inherit" });
child.once("error", (error) => { throw error; });
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
`, { mode: 0o700 });
  await chmod(concurrentCodex, 0o700);
  fixture.options.codexExecutable = concurrentCodex;

  await assert.rejects(
    setupRegistration(fixture.options),
    /alreadyAdded|ownership|requested local marketplace/i,
  );
  const state = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.equal(state.marketplaces.length, 1);
  assert.equal(state.marketplaces[0].root, fixture.paths.marketplaceRoot);
  assert.deepEqual(state.plugins, []);
  await assert.rejects(stat(fixture.paths.receiptPath), { code: "ENOENT" });
  const calls = (await readTrace(fixture.tracePath)).map((entry) => entry.argv.join(" "));
  assert.equal(calls.includes("plugin marketplace remove dev-flow-local --json"), false);
});

test("removal deletes only matching registration and the exact receipt", async (t) => {
  const fixture = await makeSetupFixture(t, "remove-matching");
  await setupRegistration(fixture.options);

  const repository = join(fixture.root, "target repository");
  const codexCache = join(fixture.root, "codex-owned-cache");
  const adjacentReceiptFile = join(dirname(fixture.paths.receiptPath), "user-note.txt");
  await mkdir(repository, { recursive: true });
  await mkdir(fixture.paths.dataDirectory, { recursive: true });
  await mkdir(codexCache, { recursive: true });
  await writeFile(join(repository, "README.md"), "preserve repository\n");
  await writeFile(join(fixture.paths.dataDirectory, "dev-flow.db"), "preserve task data\n");
  await writeFile(join(codexCache, "cache.db"), "preserve Codex cache\n");
  await writeFile(adjacentReceiptFile, "preserve adjacent receipt data\n");

  const state = JSON.parse(await readFile(fixture.statePath, "utf8"));
  state.marketplaces.push(marketplaceStateEntry("user-marketplace", "/user"));
  state.plugins.push(pluginStateEntry({
    name: "user-plugin",
    marketplaceName: "user-marketplace",
    pluginRoot: "/user/plugin",
    marketplaceRoot: "/user",
    version: "9.9.9",
  }));
  await writeFile(fixture.statePath, `${JSON.stringify(state, null, 2)}\n`);

  const preservedBefore = await Promise.all([
    directoryFingerprint(fixture.paths.packageRoot),
    directoryFingerprint(fixture.paths.dataDirectory),
    directoryFingerprint(repository),
    directoryFingerprint(codexCache),
  ]);
  const removed = await removeRegistration(fixture.options);
  assert.deepEqual(removed, { status: "removed", changed: true });
  await assert.rejects(stat(fixture.paths.receiptPath), { code: "ENOENT" });
  assert.equal(await readFile(adjacentReceiptFile, "utf8"), "preserve adjacent receipt data\n");
  assert.deepEqual(
    await Promise.all([
      directoryFingerprint(fixture.paths.packageRoot),
      directoryFingerprint(fixture.paths.dataDirectory),
      directoryFingerprint(repository),
      directoryFingerprint(codexCache),
    ]),
    preservedBefore,
  );

  const after = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.deepEqual(after.marketplaces.map((entry) => entry.name), ["user-marketplace"]);
  assert.deepEqual(after.plugins.map((entry) => entry.pluginId), ["user-plugin@user-marketplace"]);

  const repeated = await removeRegistration(fixture.options);
  assert.deepEqual(repeated, { status: "already-absent", changed: false });
  assert.equal(await readFile(adjacentReceiptFile, "utf8"), "preserve adjacent receipt data\n");
});

test("removal treats complete absence as a no-op and conflicts without a receipt", async (t) => {
  const absent = await makeSetupFixture(t, "remove-absent");
  assert.deepEqual(await removeRegistration(absent.options), {
    status: "already-absent",
    changed: false,
  });
  await assert.rejects(stat(absent.paths.receiptPath), { code: "ENOENT" });

  const orphan = await makeSetupFixture(t, "remove-orphan");
  await mkdir(dirname(orphan.statePath), { recursive: true });
  const orphanState = {
    marketplaces: [marketplaceStateEntry("dev-flow-local", orphan.paths.marketplaceRoot)],
    plugins: [],
  };
  await writeFile(orphan.statePath, `${JSON.stringify(orphanState)}\n`);
  await assert.rejects(removeRegistration(orphan.options), /without a matching registration receipt/i);
  assert.deepEqual(JSON.parse(await readFile(orphan.statePath, "utf8")), orphanState);
});

test("interrupted removal resumes from receipt and current readback", async (t) => {
  const fixture = await makeSetupFixture(t, "remove-interrupted");
  await setupRegistration(fixture.options);
  const failing = {
    ...fixture.options,
    environment: { ...fixture.environment, FAKE_CODEX_FAIL: "marketplace:remove" },
  };

  await assert.rejects(removeRegistration(failing), /Codex command failed/);
  assert.notEqual(await readReceipt(fixture.paths.receiptPath), null);
  const interrupted = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.equal(interrupted.plugins.length, 0);
  assert.equal(interrupted.marketplaces.length, 1);

  assert.deepEqual(await removeRegistration(fixture.options), { status: "removed", changed: true });
  await assert.rejects(stat(fixture.paths.receiptPath), { code: "ENOENT" });
  const finalState = JSON.parse(await readFile(fixture.statePath, "utf8"));
  assert.deepEqual(finalState, { marketplaces: [], plugins: [] });
});

test("removal fails closed on receipt identity or marketplace-root conflict", async (t) => {
  const receiptConflict = await makeSetupFixture(t, "remove-receipt-conflict");
  await setupRegistration(receiptConflict.options);
  const alteredReceipt = await readReceipt(receiptConflict.paths.receiptPath);
  alteredReceipt.paths.data_dir = join(receiptConflict.root, "different-data");
  await writeFile(receiptConflict.paths.receiptPath, `${JSON.stringify(alteredReceipt)}\n`);
  const stateBefore = await readFile(receiptConflict.statePath, "utf8");
  await assert.rejects(removeRegistration(receiptConflict.options), /receipt.*conflict/i);
  assert.equal(await readFile(receiptConflict.statePath, "utf8"), stateBefore);

  const rootConflict = await makeSetupFixture(t, "remove-root-conflict");
  await setupRegistration(rootConflict.options);
  const state = JSON.parse(await readFile(rootConflict.statePath, "utf8"));
  state.marketplaces[0].marketplaceSource.source = join(rootConflict.root, "other-marketplace");
  state.marketplaces[0].root = join(rootConflict.root, "other-marketplace");
  await writeFile(rootConflict.statePath, `${JSON.stringify(state, null, 2)}\n`);
  const conflictedBefore = await readFile(rootConflict.statePath, "utf8");
  await assert.rejects(removeRegistration(rootConflict.options), /marketplace.*conflict/i);
  assert.equal(await readFile(rootConflict.statePath, "utf8"), conflictedBefore);
  assert.notEqual(await readReceipt(rootConflict.paths.receiptPath), null);
});

test("removal rejects a receipt symbolic link before mutating Codex state", async (t) => {
  const fixture = await makeSetupFixture(t, "remove-receipt-symlink");
  await setupRegistration(fixture.options);
  const externalReceipt = join(fixture.root, "user-owned-receipt.json");
  await writeFile(externalReceipt, await readFile(fixture.paths.receiptPath));
  await rm(fixture.paths.receiptPath);
  await symlink(externalReceipt, fixture.paths.receiptPath);
  const stateBefore = await readFile(fixture.statePath, "utf8");

  await assert.rejects(removeRegistration(fixture.options), /receipt target is a symbolic link/i);
  assert.equal(await readFile(fixture.statePath, "utf8"), stateBefore);
  assert.equal(await readFile(externalReceipt, "utf8"), await readFile(fixture.paths.receiptPath, "utf8"));
  assert.equal((await lstat(fixture.paths.receiptPath)).isSymbolicLink(), true);
});

test("removal rejects a symbolic-link receipt parent before mutating Codex state", async (t) => {
  const fixture = await makeSetupFixture(t, "remove-receipt-parent-symlink");
  await setupRegistration(fixture.options);
  const receiptContents = await readFile(fixture.paths.receiptPath);
  const externalDirectory = join(fixture.root, "user-owned-registrations");
  const registrationsDirectory = dirname(fixture.paths.receiptPath);
  await mkdir(externalDirectory);
  await writeFile(join(externalDirectory, "codex.json"), receiptContents);
  await rm(registrationsDirectory, { recursive: true });
  await symlink(externalDirectory, registrationsDirectory);
  const stateBefore = await readFile(fixture.statePath, "utf8");

  await assert.rejects(removeRegistration(fixture.options), /receipt path contains a symbolic link/i);
  assert.equal(await readFile(fixture.statePath, "utf8"), stateBefore);
  assert.equal(await readFile(join(externalDirectory, "codex.json"), "utf8"), receiptContents.toString());
  assert.equal((await lstat(registrationsDirectory)).isSymbolicLink(), true);
});

async function makeRoot(t) {
  const { mkdtemp } = await import("node:fs/promises");
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-lifecycle-")));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function makeSetupFixture(t, name) {
  const root = join(await makeRoot(t), name);
  const packageRoot = join(root, "installed package-插件");
  const pluginRoot = join(packageRoot, "plugin");
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const productSupportRoot = join(root, "home", "Library", "Application Support", "dev-flow");
  const receiptPath = join(productSupportRoot, "registrations", "codex.json");
  const dataDirectory = join(productSupportRoot, "data");
  const hostBin = join(root, "host-bin");
  const statePath = join(root, "fake", "state.json");
  const tracePath = join(root, "fake", "trace.jsonl");
  await mkdir(join(packageRoot, ".agents", "plugins"), { recursive: true });
  await mkdir(join(pluginRoot, ".codex-plugin"), { recursive: true });
  await mkdir(join(pluginRoot, "skills", "dev-flow", "agents"), { recursive: true });
  await mkdir(join(packageRoot, "bin"), { recursive: true });
  await mkdir(dirname(runtimePath), { recursive: true });
  await mkdir(hostBin, { recursive: true });
  await writeFile(
    join(packageRoot, "package.json"),
    `${JSON.stringify({ name: "dev-flow-codex", version: "0.1.0", private: true })}\n`,
  );
  await writeFile(
    join(packageRoot, ".agents", "plugins", "marketplace.json"),
    `${JSON.stringify({
      name: "dev-flow-local",
      plugins: [{
        name: "dev-flow-codex",
        source: { source: "local", path: "./plugin" },
      }],
    })}\n`,
  );
  await writeFile(
    join(pluginRoot, ".codex-plugin", "plugin.json"),
    `${JSON.stringify({
      name: "dev-flow-codex",
      version: "0.1.0",
      description: "fixture",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    })}\n`,
  );
  await writeFile(
    join(pluginRoot, ".mcp.json"),
    `${JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        "dev-flow": { type: "stdio", command: "dev-flow-codex", args: ["mcp"] },
      },
    })}\n`,
  );
  await writeFile(join(pluginRoot, "skills", "dev-flow", "SKILL.md"), "$dev-flow fixture\n");
  await writeFile(
    join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"),
    "policy:\n  allow_implicit_invocation: false\n",
  );
  await writeFile(runtimePath, "#!/bin/sh\nprintf 'dev-flow 0.1.0\\n'\n", { mode: 0o700 });
  const packageLauncher = join(packageRoot, "bin", "dev-flow-codex.mjs");
  await writeFile(packageLauncher, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  await symlink(packageLauncher, join(hostBin, "dev-flow-codex"));

  const paths = {
    packageRoot,
    marketplaceRoot: packageRoot,
    pluginRoot,
    runtimePath,
    productSupportRoot,
    receiptPath,
    dataDirectory,
    runtimeKey: "darwin-arm64",
  };
  const environment = {
    ...process.env,
    PATH: `${hostBin}:${process.env.PATH ?? ""}`,
    FAKE_CODEX_STATE: statePath,
    FAKE_CODEX_TRACE: tracePath,
    FAKE_CODEX_VERSION: "0.147.0",
  };
  return {
    root,
    paths,
    statePath,
    tracePath,
    environment,
    options: {
      paths,
      packageVersion: "0.1.0",
      codexExecutable: fakeCodexPath,
      environment,
      currentDirectory: packageRoot,
      now: () => new Date("2026-08-15T00:00:00.000Z"),
    },
  };
}

async function readTrace(path) {
  return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
}

async function directoryFingerprint(root) {
  const hash = createHash("sha256");
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      hash.update(`${entry.isDirectory() ? "d" : "f"}:${relative}\0`);
      if (entry.isDirectory()) await visit(absolute, relative);
      else hash.update(await readFile(absolute));
    }
  }
  await visit(root);
  return hash.digest("hex");
}

function validReceipt(root, { receiptPath = join(root, "registrations", "codex.json") } = {}) {
  return {
    schema_version: 3,
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
      skill_metadata: "d".repeat(64),
      mcp_configuration: "c".repeat(64),
    },
    installed_at: "2026-08-15T00:00:00.000Z",
  };
}

function marketplaceStateEntry(name, root, source = root) {
  return {
    name,
    root,
    marketplaceSource: { sourceType: "local", source },
  };
}

function pluginStateEntry({ name, marketplaceName, pluginRoot, marketplaceRoot, version }) {
  return {
    pluginId: `${name}@${marketplaceName}`,
    name,
    marketplaceName,
    version,
    installed: true,
    enabled: true,
    source: { source: "local", path: pluginRoot },
    marketplaceSource: { sourceType: "local", source: marketplaceRoot },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_INSTALL",
  };
}
