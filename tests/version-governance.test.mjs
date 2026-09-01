import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkVersions } from "../scripts/check-versions.mjs";

test("three product versions are independent", async (t) => {
  const root = await fixtureRoot(t);
  await writeFile(join(root, "CORE_VERSION"), "1.2.3\n");
  await setVersion(join(root, "packages/codex/package.json"), "2.3.4");
  await setVersion(join(root, "packages/codex/plugin/.codex-plugin/plugin.json"), "2.3.4");
  await setVersion(join(root, "packages/deepseek/package.json"), "3.4.5");
  await setVersion(join(root, "packages/dev-flow/package.json"), "4.5.6");
  await setFixtureVersion(join(root, "protocol/fixtures/graph-server-info.json"), "1.2.3");
  await setNestedFixtureVersion(join(root, "packages/codex/tests/fixtures/graph-method-profiles.json"), "1.2.3");
  assert.deepEqual(await checkVersions(root), { core: "1.2.3", codex: "2.3.4", deepseek: "3.4.5", devFlow: "4.5.6" });
});

test("Core version authority accepts one Windows CRLF terminator", async (t) => {
  const root = await fixtureRoot(t);
  const expected = JSON.parse(await readFile(join(root, "protocol/fixtures/graph-server-info.json"), "utf8")).version;
  await writeFile(join(root, "CORE_VERSION"), `${expected}\r\n`);
  assert.equal((await checkVersions(root)).core, expected);
});

test("only the Codex plugin mirrors another product version", async (t) => {
  const root = await fixtureRoot(t);
  await setVersion(join(root, "packages/codex/plugin/.codex-plugin/plugin.json"), "9.9.9");
  await assert.rejects(checkVersions(root), /plugin version must equal Codex package version/u);
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(Object.hasOwn(rootPackage, "version"), false);
});

test("current product surfaces contain no internal version system except the database version", async () => {
  const root = new URL("../", import.meta.url);
  const files = [];
  for (const path of ["internal", "packages/codex/bin", "packages/codex/lib", "packages/codex/plugin", "packages/deepseek/lib", "packages/deepseek/skills", "scripts", "release"]) {
    await walk(new URL(`${path}/`, root), files);
  }
  for (const path of [
    "protocol/fixtures/graph-server-info.json", "protocol/fixtures/graph-host-parity-codex.json",
    "protocol/fixtures/graph-host-parity-deepseek.json",
  ]) files.push(new URL(path, root));

  const forbidden = /core_contract_version|core_limits_version|storage_schema_version|schema_version|snapshot_version|process_version|build_profile|standard-development@\d+|(?:requirements|design|tasks|implementation|test|comprehension|refactor|delivery)-result@\d+|blocker-resolution@\d+|ProcessActionV\d+|persistedTaskV\d+|dev-flow\/(?:git-common-dir|repository-identity|worktree-fingerprint|repository-binding)\/v\d+/iu;
  const violations = [];
  for (const file of files) {
    const path = fileURLPath(file);
    if (path.endsWith("_test.go") || path.includes("/testdata/") || path.includes("/tests/")) continue;
    if (forbidden.test(await readFile(file, "utf8"))) violations.push(path);
  }
  assert.deepEqual(violations, []);
});

async function fixtureRoot(t) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-versions-"));
  t.after(() => import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true })));
  for (const path of [
    "CORE_VERSION", "package.json", "packages/codex/package.json",
    "packages/codex/plugin/.codex-plugin/plugin.json", "packages/deepseek/package.json",
    "packages/dev-flow/package.json",
    "protocol/fixtures/graph-server-info.json", "packages/codex/tests/fixtures/graph-method-profiles.json",
  ]) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await cp(new URL(`../${path}`, import.meta.url), join(root, path), { recursive: true });
  }
  return root;
}

async function walk(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "testdata", "tests"].includes(entry.name)) continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) await walk(child, files);
    else if (/\.(?:go|mjs|js|json|sh)$/u.test(entry.name)) files.push(child);
  }
}

function fileURLPath(url) {
  return decodeURIComponent(url.pathname);
}

async function setVersion(path, version) {
  const value = JSON.parse(await readFile(path, "utf8"));
  value.version = version;
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function setFixtureVersion(path, version) {
  const value = JSON.parse(await readFile(path, "utf8"));
  value.version = version;
  await writeFile(path, `${JSON.stringify(value)}\n`);
}

async function setNestedFixtureVersion(path, version) {
  const value = JSON.parse(await readFile(path, "utf8"));
  value.server_info.version = version;
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
