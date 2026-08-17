#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { appendFile, chmod, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const argv = process.argv.slice(2);
const statePath = process.env.FAKE_RELEASE_GH_STATE;
const logPath = process.env.FAKE_RELEASE_CALL_LOG;
if (!statePath || !logPath) await fail("fake gh state/log paths are required", 2, "configuration-error");
const state = JSON.parse(await readFile(statePath, "utf8"));

if (same(argv, ["--version"])) await succeed("gh version 2.97.0 (fixture)\n", "version");

if (same(argv, ["auth", "status", "-h", "github.com"])) await succeed("", "auth-status");

if (argv[0] === "api" && argv[1] === "repos/Innocent-children/dev-flow") {
  await succeed(`${JSON.stringify(state.permissions ?? { push: true, maintain: true, admin: true })}\n`, "repo-permissions");
}

if (argv[0] === "release" && argv[1] === "view") {
  const tag = argv[2];
  if (!state.release || state.release.tagName !== tag) await notFound("release-absent");
  await succeed(`${JSON.stringify(publicRelease(state.release))}\n`, "release-view");
}

if (argv[0] === "release" && argv[1] === "create") {
  const tag = argv[2];
  if (state.release) await fail("fixture release already exists", 1, "release-create-conflict");
  const target = optionValue("--target");
  if (!argv.includes("--draft") || !target) await fail("fixture release create requires draft and target", 2, "release-create-invalid");
  state.release = {
    tagName: tag,
    isDraft: true,
    isPrerelease: false,
    targetCommitish: target,
    id: state.next_release_id ?? 101,
    url: `https://github.example.invalid/releases/${tag}`,
    assets: [],
  };
  await writeState(statePath, state);
  await succeed(`${state.release.url}\n`, "release-create");
}

if (argv[0] === "release" && argv[1] === "upload") {
  const tag = argv[2];
  const source = argv[3];
  if (!state.release || state.release.tagName !== tag || !source || argv.includes("--clobber")) {
    await fail("fixture release upload arguments/state are invalid", 2, "release-upload-invalid");
  }
  const name = basename(source);
  if (state.release.assets.some((asset) => asset.name === name)) await fail("fixture asset already exists", 1, "release-upload-conflict");
  await mkdir(state.asset_root, { recursive: true });
  const remotePath = join(state.asset_root, `${state.next_asset_id ?? 1001}-${name}`);
  await copyFile(source, remotePath);
  const asset = {
    name,
    id: state.next_asset_id ?? 1001,
    url: `https://github.example.invalid/assets/${state.next_asset_id ?? 1001}`,
    path: remotePath,
    sha256: await sha256File(remotePath),
  };
  state.next_asset_id = asset.id + 1;
  state.release.assets.push(asset);
  state.release.assets.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const failAfterUpload = state.fail_after_upload_name === name;
  if (failAfterUpload) state.fail_after_upload_name = null;
  await writeState(statePath, state);
  if (failAfterUpload) await fail("fixture process failed after immutable asset upload", 1, "asset-uploaded-then-failed");
  await succeed("", "release-upload");
}

if (argv[0] === "release" && argv[1] === "download") {
  const tag = argv[2];
  const pattern = optionValue("--pattern");
  const directory = optionValue("--dir");
  const asset = state.release?.tagName === tag
    ? state.release.assets.find((candidate) => candidate.name === pattern)
    : null;
  if (!asset || !directory) await fail("fixture asset download target is absent", 1, "release-download-missing");
  await mkdir(directory, { recursive: true });
  const target = join(directory, pattern);
  await copyFile(asset.path, target);
  if (state.corrupt_download_name === pattern) await appendFile(target, "fixture-corruption", "utf8");
  await succeed("", "release-download");
}

if (argv[0] === "release" && argv[1] === "edit") {
  if (state.fail_finalize || !state.release) await fail("fixture finalization refused", 1, "release-edit-failed");
  if (argv.includes("--draft=false")) {
    state.release.isDraft = false;
    await writeState(statePath, state);
  }
  await succeed("", "release-edit");
}

await fail(`unsupported fake gh command: ${argv.join(" ")}`, 2, "unsupported-command");

function optionValue(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function publicRelease(release) {
  return {
    tagName: release.tagName,
    isDraft: release.isDraft,
    isPrerelease: release.isPrerelease,
    targetCommitish: release.targetCommitish,
    id: release.id,
    url: release.url,
    assets: release.assets.map((asset) => ({ name: asset.name, id: asset.id, url: asset.url })),
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function record(result) {
  const boundedArgv = argv.slice(0, 24).map((value) => String(value).slice(0, 400));
  await appendFile(logPath, `${JSON.stringify({ tool: "gh", argv: boundedArgv, result })}\n`, { encoding: "utf8", mode: 0o600 });
}

async function writeState(path, value) {
  const temporary = join(dirname(path), `.${basename(path)}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function succeed(stdout, result) {
  await record(result);
  process.stdout.write(stdout);
  process.exit(0);
}

async function notFound(result) {
  await record(result);
  process.stderr.write("release not found\n");
  process.exit(1);
}

async function fail(message, code, result) {
  if (logPath) await record(result).catch(() => {});
  process.stderr.write(`${String(message).slice(0, 500)}\n`);
  process.exit(code);
}
