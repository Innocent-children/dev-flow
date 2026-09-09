import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { desktopApplications, stageDesktopPackage } from "../../scripts/desktop-pet-package.mjs";
import { packageFiles, verifyPackage, verifyWindowsApplication } from "./prepare.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function directory(t) {
  const value = await mkdtemp(join(tmpdir(), "dev-flow-release-contract-"));
  t.after(() => rm(value, { recursive: true, force: true }));
  return value;
}

test("formal staging lists both native applications and contains source files without local Adapter archives", async t => {
  const stage = await directory(t);
  const manifest = await stageDesktopPackage(root, stage, desktopApplications);
  assert.deepEqual(manifest.files.filter(path => path.startsWith("runtime/")), desktopApplications);
  assert.equal(manifest.devFlowLocalPackages, undefined);
  const files = await packageFiles(stage);
  assert.equal(Object.keys(files).some(path => path.startsWith("local-packages/")), false);
  assert.equal(typeof files["bin/dev-flow.mjs"], "string");
  await assert.rejects(verifyPackage(stage, manifest), /ENOENT/);
});

test("final package verification rejects altered bytes, manifest and incomplete platform declarations", async t => {
  const stage = await directory(t);
  const manifest = await stageDesktopPackage(root, stage, desktopApplications);
  const files = await packageFiles(stage);
  await writeFile(join(stage, "README.md"), "altered");
  await assert.rejects(verifyPackage(stage, manifest, files), /files differ/);
  await writeFile(join(stage, "package.json"), JSON.stringify({ ...manifest, version: "999.0.0" }));
  await assert.rejects(verifyPackage(stage, manifest), /manifest differs/);
  const incomplete = { ...manifest, files: manifest.files.filter(path => path !== desktopApplications[1]) };
  await writeFile(join(stage, "package.json"), JSON.stringify(incomplete));
  await assert.rejects(verifyPackage(stage, incomplete), /both applications/);
});

test("tree verification refuses symlinks and detects unexpected runtime files", async t => {
  const stage = await directory(t);
  const manifest = await stageDesktopPackage(root, stage, desktopApplications);
  const files = await packageFiles(stage);
  await mkdir(join(stage, "runtime"));
  await writeFile(join(stage, "runtime", "unexpected"), "extra");
  await assert.rejects(verifyPackage(stage, manifest, files), /files differ/);
  await symlink(join(stage, "README.md"), join(stage, "link"));
  await assert.rejects(packageFiles(stage), /non-regular entry/);
});

test("Windows application validation refuses non-PE and non-x64 executables", async t => {
  const stage = await directory(t);
  await writeFile(join(stage, "DevFlowPet.exe"), "not an application");
  await assert.rejects(verifyWindowsApplication(stage, "1.0.0"), /not PE/);
  const pe = Buffer.alloc(128);
  pe.write("MZ"); pe.writeUInt32LE(64, 60); pe.writeUInt32LE(0x4550, 64); pe.writeUInt16LE(0x14c, 68);
  await writeFile(join(stage, "DevFlowPet.exe"), pe);
  await assert.rejects(verifyWindowsApplication(stage, "1.0.0"), /PE x64/);
});
