import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { buildMacDesktopApplication, verifyDesktopPet } from "../../scripts/build-desktop-pet.mjs";
import { stageWindowsDesktopApplication } from "../../scripts/build-desktop-pet-windows.mjs";
import { verifyDefaultArtwork } from "../../scripts/desktop-pet-artwork.mjs";
import { desktopApplications, stageDesktopPackage } from "../../scripts/desktop-pet-package.mjs";
import { normalizeUstarArchive } from "../../scripts/dev-flow-local.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const execFile = promisify(execFileCallback);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const run = (command, args) => execFile(command, args, {
  encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 600_000, shell: false,
});

// An exact tree comparison checks every runtime dependency after archive extraction.
export async function packageFiles(directory, prefix = "") {
  const files = {};
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), key = prefix + name;
    const info = await lstat(path);
    if (info.isDirectory()) Object.assign(files, await packageFiles(path, `${key}/`));
    else if (info.isFile()) files[key] = digest(await readFile(path));
    else throw new Error(`package contains a non-regular entry: ${key}`);
  }
  return files;
}

export async function verifyWindowsApplication(application, version) {
  const executable = await readFile(join(application, "DevFlowPet.exe"));
  if (executable.length < 64 || executable.toString("ascii", 0, 2) !== "MZ") throw new Error("Windows desktop executable is not PE");
  const pe = executable.readUInt32LE(60);
  if (pe + 6 > executable.length || executable.readUInt32LE(pe) !== 0x4550 || executable.readUInt16LE(pe + 4) !== 0x8664) {
    throw new Error("Windows desktop executable must be PE x64");
  }
  for (const file of ["icudtl.dat", "resources.pak", "v8_context_snapshot.bin", "locales/en-US.pak", "LICENSE", "LICENSES.chromium.html"]) {
    if (!(await lstat(join(application, file))).isFile()) throw new Error(`Windows runtime file missing: ${file}`);
  }
  const app = join(application, "resources", "app");
  const manifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
  if (manifest.version !== version || manifest.main !== "main.cjs") throw new Error("Windows desktop application version or entry differs");
  for (const file of ["main.cjs", "storage.cjs", "appearance.cjs", "observation.cjs", "task-collection.cjs", "preload.cjs", "view.js", "view.html", "view.css", "decode.html"]) {
    if (!(await readFile(join(app, file))).equals(await readFile(join(root, "packages/desktop-pet/windows", file)))) throw new Error(`Windows application differs from source: ${file}`);
  }
  for (const module of ["saxes", "xmlchars", "image-size"]) await readFile(join(app, "node_modules", module, "package.json"));
  return verifyDefaultArtwork(join(app, "default-appearance"));
}

export async function verifyPackage(directory, expectedManifest, expectedFiles) {
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest) || manifest.devFlowLocalPackages) throw new Error("desktop package manifest differs");
  if (!desktopApplications.every(path => manifest.files.includes(path))) throw new Error("desktop package requires both applications");
  if (expectedFiles && JSON.stringify(await packageFiles(directory)) !== JSON.stringify(expectedFiles)) throw new Error("extracted desktop package files differ");
  const mac = join(directory, desktopApplications[0]);
  const plist = await readFile(join(mac, "Contents", "Info.plist"), "utf8");
  for (const field of ["CFBundleVersion", "CFBundleShortVersionString"]) {
    if (!plist.includes(`<key>${field}</key><string>${manifest.version}</string>`)) throw new Error("macOS desktop application version differs");
  }
  const macAssets = await verifyDesktopPet(mac);
  const windowsAssets = await verifyWindowsApplication(join(directory, desktopApplications[1]), manifest.version);
  return { "darwin-arm64": { signing: "ad-hoc", ...macAssets }, "win32-x64": { signing: "unsigned", ...windowsAssets } };
}

async function windowsDependencies(work) {
  const dependenciesRoot = join(work, "windows-dependencies");
  await mkdir(dependenciesRoot);
  for (const file of ["package.json", "package-lock.json"]) {
    await copyFile(join(root, "packages/desktop-pet/windows", file), join(dependenciesRoot, file));
  }
  await run("npm", ["ci", "--prefix", dependenciesRoot, "--ignore-scripts", "--no-audit", "--no-fund"]);
  const require = createRequire(join(dependenciesRoot, "package.json"));
  const { downloadArtifact } = require("@electron/get");
  const version = require("electron/package.json").version;
  const zip = await downloadArtifact({ version, artifactName: "electron", platform: "win32", arch: "x64" });
  const electronDirectory = join(work, "electron-win32-x64");
  await mkdir(electronDirectory);
  await run("/usr/bin/unzip", ["-q", zip, "-d", electronDirectory]);
  return { dependenciesRoot, electronDirectory };
}

// Preparation writes only the selected external directory. Publication stays in publish.mjs.
export async function prepareDevFlow({ outputRoot, sourceCommit }) {
  if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("formal desktop preparation requires macOS arm64");
  if (!isAbsolute(outputRoot)) throw new Error("output must be an absolute directory outside the repository");
  await mkdir(outputRoot, { recursive: true });
  const output = await realpath(outputRoot);
  const offset = relative(await realpath(root), output);
  if (!offset || (!offset.startsWith("..") && !isAbsolute(offset))) throw new Error("output must be outside the repository");
  const work = await mkdtemp(join(output, ".prepare-desktop-"));
  try {
    const stage = join(work, "package");
    const manifest = await stageDesktopPackage(root, stage, desktopApplications);
    await buildMacDesktopApplication({ application: join(stage, desktopApplications[0]), work, version: manifest.version });
    const dependencies = await windowsDependencies(work);
    await stageWindowsDesktopApplication({ application: join(stage, desktopApplications[1]), version: manifest.version, ...dependencies });
    await verifyPackage(stage, manifest);
    const files = await packageFiles(stage);
    const archive = join(work, "package.tar");
    await run("/usr/bin/tar", ["-cf", archive, "--format", "ustar", "-C", work, "package"]);
    const bytes = gzipSync(normalizeUstarArchive(await readFile(archive), new Set([
      "package/bin/dev-flow.mjs", `package/${desktopApplications[0]}/Contents/MacOS/DevFlowPet`,
    ])), { level: 9, mtime: 0 });
    const tarball = join(output, `imotong-dev-flow-${manifest.version}.tgz`);
    await writeFile(tarball, bytes);
    await chmod(tarball, 0o644);
    const extracted = join(work, "extracted");
    await mkdir(extracted);
    await run("/usr/bin/tar", ["-xzf", tarball, "-C", extracted]);
    const applications = await verifyPackage(join(extracted, "package"), manifest, files);
    const sha256 = digest(bytes);
    const record = {
      release: { product: "dev-flow", version: manifest.version, source_commit: sourceCommit },
      artifacts: [{ kind: "npm_tarball", relative_path: basename(tarball), sha256 }],
      desktop_applications: applications,
    };
    await writeFile(join(output, "SHA256SUMS"), `${sha256}  ${basename(tarball)}\n`);
    await writeFile(join(output, "release-manifest.json"), `${JSON.stringify(record, null, 2)}\n`);
    return { tarball, sha256, ...record };
  } finally { await rm(work, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: node release/dev-flow/prepare.mjs --output <absolute-directory>");
  const sourceCommit = (await run("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
  prepareDevFlow({ outputRoot: args[1], sourceCommit }).then(
    result => console.log(JSON.stringify(result)),
    error => { console.error(error.stderr ?? error); process.exitCode = 1; },
  );
}
