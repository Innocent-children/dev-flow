#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { appendFile, chmod, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const argv = process.argv.slice(2);
const statePath = process.env.FAKE_RELEASE_NPM_STATE;
const logPath = process.env.FAKE_RELEASE_CALL_LOG;
if (!statePath || !logPath) await fail("fake npm state/log paths are required", 2, "configuration-error");

const state = JSON.parse(await readFile(statePath, "utf8"));

if (same(argv, ["--version"])) await succeed("11.16.0\n", "version");

if (argv[0] === "whoami" && argv.length === 2 && officialRegistry(argv[1])) {
  await succeed(`${state.account}\n`, "whoami");
}

if (argv[0] === "owner" && argv[1] === "ls" && argv[2] === "dev-flow-codex" && argv.length === 4 && officialRegistry(argv[3])) {
  if (!state.package_exists) await notFound("owner-list-absent");
  await succeed(`${(state.owners ?? []).join("\n")}\n`, "owner-list");
}

if (argv[0] === "view" && argv[1] === "dev-flow-codex") {
  if (!officialRegistry(argv.at(-1))) await fail("fake npm view requires the official registry", 2, "invalid-registry");
  if (!state.package_exists) await notFound("package-absent");
  await succeed(`${JSON.stringify({
    name: "dev-flow-codex",
    version: state.version,
    maintainers: (state.owners ?? []).map((name) => ({ name })),
    "dist-tags": state.version ? { latest: state.version } : {},
  })}\n`, "package-view");
}

if (argv[0] === "view" && /^dev-flow-codex@/u.test(argv[1] ?? "")) {
  if (!officialRegistry(argv.at(-1))) await fail("fake npm version view requires the official registry", 2, "invalid-registry");
  const version = argv[1].slice("dev-flow-codex@".length);
  if (state.version !== version) await notFound("version-absent");
  if ((state.delayed_reads_remaining ?? 0) > 0) {
    state.delayed_reads_remaining -= 1;
    await writeState(statePath, state);
    await notFound("version-delayed");
  }
  if (state.fail_version_view) await fail("fixture registry metadata read failed", 1, "version-view-failed");
  await succeed(`${JSON.stringify({
    version,
    dist: {
      integrity: state.integrity,
      tarball: `https://registry.example.invalid/dev-flow-codex-${version}.tgz`,
    },
  })}\n`, "version-view");
}

if (argv[0] === "publish" && argv.length === 5 && argv[2] === "--access" && argv[3] === "public" && officialRegistry(argv[4])) {
  if (state.version !== null) await fail("fixture immutable version already exists", 1, "publish-conflict");
  const source = argv[1];
  const version = state.expected_version ?? "0.1.0";
  const remoteRoot = state.remote_root;
  if (!remoteRoot) await fail("fixture remote_root is required", 2, "configuration-error");
  await mkdir(remoteRoot, { recursive: true });
  const remoteTarball = join(remoteRoot, `dev-flow-codex-${version}.tgz`);
  await copyFile(source, remoteTarball);
  state.package_exists = true;
  state.version = version;
  state.remote_tarball = remoteTarball;
  state.integrity = "sha512-fixture-integrity";
  state.publish_count = (state.publish_count ?? 0) + 1;
  state.remote_sha256 = await sha256File(remoteTarball);
  const failAfterPublish = state.fail_after_publish === true;
  state.fail_after_publish = false;
  await writeState(statePath, state);
  if (failAfterPublish) await fail("fixture process failed after immutable npm publish", 1, "publish-committed-then-failed");
  await succeed(`${JSON.stringify({ id: `dev-flow-codex@${version}` })}\n`, "publish");
}

if (argv[0] === "pack" && /^dev-flow-codex@/u.test(argv[1] ?? "")) {
  const destinationIndex = argv.indexOf("--pack-destination");
  if (destinationIndex < 0 || !officialRegistry(argv.at(-1)) || state.version === null || !state.remote_tarball) {
    await fail("fixture npm pack arguments/state are invalid", 2, "pack-invalid");
  }
  const destination = argv[destinationIndex + 1];
  await mkdir(destination, { recursive: true });
  const filename = `dev-flow-codex-${state.version}.tgz`;
  const target = join(destination, filename);
  await copyFile(state.remote_tarball, target);
  if (state.corrupt_readback === true) await appendFile(target, "fixture-corruption", "utf8");
  await succeed(`${JSON.stringify([{ filename }])}\n`, "pack-readback");
}

await fail(`unsupported fake npm command: ${argv.join(" ")}`, 2, "unsupported-command");

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function officialRegistry(value) {
  return value === "--registry=https://registry.npmjs.org/";
}

async function record(result) {
  const boundedArgv = argv.slice(0, 24).map((value) => String(value).slice(0, 400));
  await appendFile(logPath, `${JSON.stringify({ tool: "npm", argv: boundedArgv, result })}\n`, { encoding: "utf8", mode: 0o600 });
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
  process.stderr.write("npm error code E404\nnpm error 404 Not Found\n");
  process.exit(1);
}

async function fail(message, code, result) {
  if (logPath) await record(result).catch(() => {});
  process.stderr.write(`${String(message).slice(0, 500)}\n`);
  process.exit(code);
}
