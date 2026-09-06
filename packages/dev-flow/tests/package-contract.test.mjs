import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runDevFlow } from "../lib/runtime.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageIconUrl = "https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg";

test("package README displays the public Dev Flow icon", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  assert.match(readme, new RegExp(`<img src="${packageIconUrl}" width="112" height="112" alt="Dev Flow" \\/>`));
});

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
  assert.equal(manifest.files.includes("lib/pet.mjs"), true);
  assert.equal(manifest.files.includes("lib/platform/macos/pet.mjs"), true);
  assert.deepEqual(manifest.scripts, {
    test: "node --test tests/*.test.mjs",
    "test:package": "node --test tests/package-contract.test.mjs",
    "pack:dry": "pnpm pack --dry-run --json",
  });
});

test("the public command inventory names the desktop pet surface", async () => {
  const stdout = { text: "", write(value) { this.text += value; return true; } };
  assert.equal((await runDevFlow(["help"], { stdout })).code, 0);
  assert.match(stdout.text, /^ {2}dev-flow pet start\|stop$/mu);

  // The shipped entry dispatches `pet` ahead of the lifecycle surface and reports
  // the launcher argument contract, so an unsupported form never reaches a Host.
  const invalid = spawnSync(process.execPath, [join(packageRoot, "bin", "dev-flow.mjs"), "pet", "status"], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "en_US.UTF-8" },
  });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, "");
  assert.equal(invalid.stderr, "dev-flow: invalid arguments; the supported forms are dev-flow pet start and dev-flow pet stop\n");
});
