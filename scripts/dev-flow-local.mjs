#!/usr/bin/env node

import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { execPortableCommand } from "../packages/dev-flow/lib/command.mjs";
import { buildWebUI } from "./build-webui.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

export function normalizeForwardedArguments(arguments_) {
  return arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
}

export async function copyExecutable(source, target, dependencies = {}) {
  await (dependencies.copyFile ?? copyFile)(source, target);
  if ((dependencies.platform ?? process.platform) !== "win32") {
    await (dependencies.chmod ?? chmod)(target, 0o755);
  }
}

export async function runLocalDevFlow(arguments_, dependencies = {}) {
  const run = dependencies.run ?? runCommand;
  const root = dependencies.repositoryRoot ?? repositoryRoot;
  const temporaryRoot = await (dependencies.mkdtemp ?? mkdtemp)(join(tmpdir(), "dev-flow-local-"));
  try {
    const artifacts = await buildPackages({ root, temporaryRoot, run });
    process.stderr.write(`dev-flow-local: built local packages in ${temporaryRoot}\n`);
    const managerRoot = join(temporaryRoot, "manager");
    await mkdir(managerRoot, { recursive: true });
    await run("tar", ["-xzf", artifacts.manager.path, "-C", managerRoot], { cwd: root });
    const packageRoot = join(managerRoot, "package");
    const lifecyclePath = join(packageRoot, "lib", "lifecycle.mjs");
    const { runMain } = await import(pathToFileURL(lifecyclePath).href);
    const forwarded = normalizeForwardedArguments(arguments_);
    const runtimeOperation = forwarded[0] === "webui" || ["help", "--help", "-h", "version", "--version"].includes(forwarded[0]);
    const result = runtimeOperation
      ? await (await import(pathToFileURL(join(packageRoot, "lib", "runtime.mjs")).href)).runDevFlow(forwarded)
      : await runMain(forwarded, {
        localPackages: {
          codex: { path: artifacts.codex.path, version: artifacts.codex.version },
          deepseek: { path: artifacts.deepseek.path, version: artifacts.deepseek.version },
        },
      });
    return result.code;
  } finally {
    await (dependencies.rm ?? rm)(temporaryRoot, { recursive: true, force: true });
  }
}

async function buildPackages({ root, temporaryRoot, run }) {
  const outputRoot = join(temporaryRoot, "artifacts");
  const stageRoot = join(temporaryRoot, "stages");
  await mkdir(outputRoot, { recursive: true });
  await mkdir(stageRoot, { recursive: true });

  await buildWebUI({ repositoryRoot: root, run });
  const darwinCorePath = join(temporaryRoot, "dev-flow-core-darwin-arm64");
  const windowsCorePath = join(temporaryRoot, "dev-flow-core-windows-amd64.exe");
  const coreVersion = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
  await run("go", [
    "build", "-mod=readonly", "-trimpath", "-buildvcs=false",
    "-ldflags", `-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=${coreVersion}`,
    "-o", darwinCorePath, "./cmd/dev-flow",
  ], { cwd: root, environment: { ...process.env, CGO_ENABLED: "0", GOOS: "darwin", GOARCH: "arm64" } });
  await run("go", [
    "build", "-mod=readonly", "-trimpath", "-buildvcs=false",
    "-ldflags", `-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=${coreVersion}`,
    "-o", windowsCorePath, "./cmd/dev-flow",
  ], { cwd: root, environment: { ...process.env, CGO_ENABLED: "0", GOOS: "windows", GOARCH: "amd64" } });
  const corePaths = new Map([
    ["runtime/darwin-arm64/dev-flow", darwinCorePath],
    ["runtime/win32-x64/dev-flow.exe", windowsCorePath],
  ]);

  const codex = await stageAndPack("codex", { root, stageRoot, outputRoot, corePaths, run });
  const deepseek = await stageAndPack("deepseek", { root, stageRoot, outputRoot, corePaths, run });
  const manager = await stageAndPack("dev-flow", { root, stageRoot, outputRoot, corePaths: null, run });
  return { codex, deepseek, manager };
}

async function stageAndPack(product, { root, stageRoot, outputRoot, corePaths, run }) {
  const packageRoot = join(root, "packages", product);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const productStageRoot = join(stageRoot, product);
  const destination = join(productStageRoot, "package");
  const files = [...new Set(["package.json", "README.md", ...manifest.files])];
  for (const relativePath of files) {
    const target = join(destination, relativePath);
    await mkdir(dirname(target), { recursive: true });
    if (relativePath === "LICENSE") await copyFile(join(root, "LICENSE"), target);
    else if (corePaths?.has(relativePath)) {
      await copyExecutable(corePaths.get(relativePath), target);
      if (process.platform !== "win32" && ((await stat(target)).mode & 0o111) === 0) throw new Error(`local ${product} staged Core is not executable`);
    }
    else await copyFile(join(packageRoot, relativePath), target);
  }
  let artifactPath;
  if (corePaths) {
    const filename = `${manifest.name.replace(/^@/u, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
    artifactPath = join(outputRoot, filename);
    await run("tar", ["-czf", artifactPath, "-C", productStageRoot, "package"], { cwd: root });
    artifactPath = await realpath(artifactPath);
  } else {
    const result = await run("pnpm", ["--config.ignore-scripts=true", "--dir", destination, "pack", "--pack-destination", outputRoot, "--json"], { cwd: root });
    const reportValue = JSON.parse(result.stdout);
    const report = Array.isArray(reportValue) ? reportValue[0] : reportValue;
    artifactPath = await realpath(resolve(outputRoot, report.filename));
    if (report.name !== manifest.name || report.version !== manifest.version) throw new Error(`local ${product} package identity is invalid`);
  }
  if (!(await stat(artifactPath)).isFile()) throw new Error(`local ${product} package is missing`);
  if (corePaths) {
    const verificationRoot = join(stageRoot, `${product}-verification`);
    await mkdir(verificationRoot, { recursive: true });
    await run("tar", ["-xzf", artifactPath, "-C", verificationRoot], { cwd: root });
    for (const relativePath of corePaths.keys()) {
      const packagedCore = await stat(join(verificationRoot, "package", relativePath));
      if (process.platform !== "win32" && (packagedCore.mode & 0o111) === 0) throw new Error(`local ${product} packaged Core is not executable (${(packagedCore.mode & 0o777).toString(8)})`);
    }
  }
  return { path: artifactPath, version: manifest.version };
}

async function runCommand(executable, arguments_, { cwd, environment = process.env } = {}) {
  try {
    return await execPortableCommand(executable, arguments_, {
      cwd,
      env: environment,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
      shell: false,
    });
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(`${executable} ${arguments_.join(" ")} failed${detail ? `: ${detail}` : ""}`, { cause: error });
  }
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => "") === await realpath(scriptPath)) {
  runLocalDevFlow(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => {
      process.stderr.write(`dev-flow-local: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
