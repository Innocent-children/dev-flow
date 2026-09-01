import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("manifest exposes one dependency-free public macOS arm64 and Windows x64 Dev Flow package", async () => {
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "@imotong/dev-flow");
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u);
  assert.equal(manifest.private, false);
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.os, ["darwin", "win32"]);
  assert.deepEqual(manifest.cpu, ["arm64", "x64"]);
  assert.deepEqual(manifest.engines, { node: ">=20" });
  assert.deepEqual(manifest.bin, { "dev-flow": "bin/dev-flow.mjs" });
  assert.equal(Object.keys(manifest).some((field) => /dependencies/iu.test(field)), false);
  assert.equal(manifest.files.some((path) => /[*?{}[\]]/u.test(path)), false);
  for (const path of manifest.files) assert.equal((await stat(join(packageRoot, path))).isFile(), true, path);
  assert.deepEqual(manifest.scripts, {
    test: "node --test tests/*.test.mjs",
    "test:package": "node --test tests/package-contract.test.mjs",
    "pack:dry": "pnpm pack --dry-run --json",
  });
});
