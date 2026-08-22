#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { FINAL_NATIVE_EVIDENCE_KIND, QUICK_NATIVE_EVIDENCE_KIND } from "./write-deepseek-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const options = parseArguments(process.argv.slice(2));
const quick = options.mode === "--quick-registry";
const root = await mkdtemp(join(tmpdir(), "dev-flow-deepseek-registry-"));
try {
  const packDirectory = join(root, "pack");
  const extractDirectory = join(root, "extract");
  const dshHome = join(root, "dsh-home");
  const isolatedHome = join(root, "home");
  const temporaryDirectory = join(root, "tmp");
  await Promise.all([packDirectory, extractDirectory, dshHome, isolatedHome, temporaryDirectory, options.resultDirectory].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  const packed = JSON.parse((await execFile("npm", ["pack", `${options.packageName}@${options.version}`, "--json", "--pack-destination", packDirectory, `--registry=${options.registry}`], { encoding: "utf8" })).stdout);
  const tarball = join(packDirectory, packed[0].filename);
  if (await sha256(tarball) !== options.tarballSHA256) throw new Error("registry DeepSeek tarball differs from the published release bytes");
  await execFile("tar", ["-xzf", tarball, "-C", extractDirectory]);
  const core = join(extractDirectory, "package", "runtime", "darwin-arm64", "dev-flow");
  if (await sha256(core) !== options.coreSHA256) throw new Error("registry DeepSeek Core differs from the published release bytes");
  await chmod(core, 0o755);
  const coreVersionLine = (await execFile(core, ["version"], { encoding: "utf8" })).stdout.trim();
  const coreVersion = /^dev-flow ((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/u.exec(coreVersionLine)?.[1];
  if (!coreVersion) throw new Error("registry DeepSeek Core returned an invalid identity");

  const environment = { ...process.env, DSH_HOME: dshHome, HOME: isolatedHome, TMPDIR: temporaryDirectory };
  const gates = ["registry-bytes", "core-identity", "dsh-version"];
  const dshVersion = (await execFile(options.dshExecutable, ["--version"], { encoding: "utf8", env: environment })).stdout.trim();
  if (!dshVersion.includes("0.1.0-rc.8")) throw new Error("DeepSeek release requires exact DSH 0.1.0-rc.8");
  if (!quick) {
    await execFile(options.dshExecutable, ["plugin", "--profile", "headless", "add", tarball], { encoding: "utf8", env: environment, timeout: 120_000 });
    gates.push("plugin-install");
    await execFile(options.dshExecutable, ["--profile", "headless", "--dump-default-config"], { encoding: "utf8", env: environment, timeout: 60_000 });
    gates.push("bundle-compose");
    await execFile(options.dshExecutable, ["plugin", "--profile", "headless", "remove", "dev-flow-deepseek"], { encoding: "utf8", env: environment, timeout: 120_000 });
    gates.push("plugin-remove");
    await execFile(options.dshExecutable, ["plugin", "--profile", "headless", "add", tarball], { encoding: "utf8", env: environment, timeout: 120_000 });
    gates.push("plugin-reinstall");
  }
  const evidence = {
    evidence_kind: quick ? QUICK_NATIVE_EVIDENCE_KIND : FINAL_NATIVE_EVIDENCE_KIND,
    package_name: options.packageName,
    version: options.version,
    registry: options.registry,
    npm_tarball_sha256: options.tarballSHA256,
    npm_integrity: options.npmIntegrity,
    core_sha256: options.coreSHA256,
    core_version: coreVersion,
    source_commit: options.sourceCommit,
    dsh_version: "0.1.0-rc.8",
    compatible_dsh_range: ">=0.1.0-rc.8 <0.2.0",
    observed_at: new Date().toISOString(),
    gates,
  };
  const name = quick ? "quick-journey-evidence.json" : "final-journey-evidence.json";
  await writeFile(join(options.resultDirectory, name), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}

function parseArguments(args) {
  const result = { mode: args[0] };
  if (!["--final-registry", "--quick-registry"].includes(result.mode)) throw new Error("DeepSeek journey requires --final-registry or --quick-registry");
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    if (key === "--package") result.packageName = value;
    else if (key === "--version") result.version = value;
    else if (key === "--registry") result.registry = value;
    else if (key === "--tarball-sha256") result.tarballSHA256 = value;
    else if (key === "--npm-integrity") result.npmIntegrity = value;
    else if (key === "--core-sha256") result.coreSHA256 = value;
    else if (key === "--source-commit") result.sourceCommit = value;
    else if (key === "--dsh-executable") result.dshExecutable = value;
    else if (key === "--workspace") result.workspace = value;
    else if (key === "--result-directory") result.resultDirectory = value;
    else throw new Error(`unknown argument ${key}`);
  }
  for (const key of ["packageName", "version", "registry", "tarballSHA256", "npmIntegrity", "coreSHA256", "sourceCommit", "dshExecutable", "workspace", "resultDirectory"]) if (!result[key]) throw new Error(`missing DeepSeek journey ${key}`);
  return result;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
