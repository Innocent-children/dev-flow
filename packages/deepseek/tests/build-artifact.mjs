import { execFile as execFileCallback } from "node:child_process";
import { copyFile, chmod, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));

const options = parseArguments(process.argv.slice(2));
if (!isAbsolute(options.output)) throw new Error("--output must be an absolute path");
if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error("--source-commit must be a full Git SHA");
await assertMissing(options.output);

const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const packagePaths = ["package.json", "README.md", ...manifest.files]
  .filter((path, index, values) => values.indexOf(path) === index);
const repositoryPaths = [
  "LICENSE",
  ...packagePaths
    .filter((path) => path !== "LICENSE")
    .filter((path) => path !== "runtime/darwin-arm64/dev-flow")
    .filter((path) => path !== "runtime/win32-x64/dev-flow.exe")
    .map((path) => join("packages", "deepseek", path)),
];
await execFile("git", ["cat-file", "-e", `${options.sourceCommit}^{commit}`], { cwd: repositoryRoot });
await execFile("git", ["diff", "--quiet", options.sourceCommit, "--", ...repositoryPaths], { cwd: repositoryRoot });

const buildRoot = await mkdtemp(join(tmpdir(), "dev-flow-deepseek-artifact-"));
try {
  const stageRoot = join(buildRoot, "package");
  await mkdir(stageRoot, { mode: 0o755 });
  const copied = [];
  for (const relativePath of packagePaths) {
    const sourcePath = relativePath === "LICENSE"
      ? join(repositoryRoot, "LICENSE")
      : join(packageRoot, relativePath);
    const info = await stat(sourcePath);
    if (!info.isFile()) throw new Error(`artifact source is not a file: ${relativePath}`);
    const destinationPath = join(stageRoot, relativePath);
    await mkdir(dirname(destinationPath), { recursive: true, mode: 0o755 });
    await copyFile(sourcePath, destinationPath);
    await chmod(destinationPath, relativePath.startsWith("runtime/") ? 0o755 : 0o644);
    copied.push(`package/${relativePath}`);
  }

  const fixedTime = new Date("1985-10-26T08:15:00.000Z");
  for (const path of copied) await utimes(join(buildRoot, path), fixedTime, fixedTime);
  const listPath = join(buildRoot, "files.txt");
  await writeFile(listPath, `${copied.sort().join("\n")}\n`);
  const tarPath = join(buildRoot, "artifact.tar");
  await execFile("tar", [
    "-cf", tarPath, "--format", "ustar", "--uid", "0", "--gid", "0",
    "--uname", "root", "--gname", "root", "-T", listPath,
  ], { cwd: buildRoot, maxBuffer: 16 * 1024 * 1024 });
  const { stdout: compressed } = await execFile("gzip", ["-n", "-c", tarPath], {
    encoding: "buffer", maxBuffer: 16 * 1024 * 1024,
  });
  await writeFile(options.output, compressed, { flag: "wx", mode: 0o644 });
  const artifact = await fileIdentity(options.output);
  const corePath = join(stageRoot, "runtime", "darwin-arm64", "dev-flow");
  const core = await fileIdentity(corePath);
  const windowsCorePath = join(stageRoot, "runtime", "win32-x64", "dev-flow.exe");
  const windowsCore = await fileIdentity(windowsCorePath);
  const { stdout: windowsBuildMetadata } = await execFile("go", ["version", "-m", windowsCorePath], { encoding: "utf8" });
  if (!/\tbuild\tGOOS=windows(?:\r?\n|$)/u.test(windowsBuildMetadata) ||
      !/\tbuild\tGOARCH=amd64(?:\r?\n|$)/u.test(windowsBuildMetadata) ||
      !/\tbuild\tCGO_ENABLED=0(?:\r?\n|$)/u.test(windowsBuildMetadata)) {
    throw new Error("packaged Windows Core build metadata is invalid");
  }
  const { stdout: coreIdentity } = await execFile(corePath, ["version"], { encoding: "utf8" });
  const coreVersion = /^dev-flow (\S+)\n?$/u.exec(coreIdentity)?.[1];
  if (coreVersion === undefined) throw new Error("packaged Core returned an invalid version line");
  process.stdout.write(`${JSON.stringify({
    source_commit: options.sourceCommit,
    package_version: manifest.version,
    core_version: coreVersion,
    artifact: { path: options.output, ...artifact },
    core,
    windows_core: windowsCore,
    package_files: copied.map((path) => path.slice("package/".length)),
  })}\n`);
} finally {
  await rm(buildRoot, { recursive: true, force: true });
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    if (key === "--output") result.output = value;
    else if (key === "--source-commit") result.sourceCommit = value;
    else throw new Error(`unknown argument ${key}`);
  }
  if (result.output === undefined || result.sourceCommit === undefined) {
    throw new Error("usage: build-artifact.mjs --output ABSOLUTE_TGZ --source-commit GIT_SHA");
  }
  return result;
}

async function assertMissing(path) {
  try {
    await stat(path);
    throw new Error(`output already exists: ${path}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function fileIdentity(path) {
  const contents = await readFile(path);
  return { size: contents.length, sha256: createHash("sha256").update(contents).digest("hex") };
}
