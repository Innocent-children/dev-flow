#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { bakeAssets, checkAssetRoot } from "../packages/desktop-pet/tools/bake.mjs";
import { normalizeUstarArchive } from "./dev-flow-local.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const applicationRelativePath = "runtime/darwin-arm64/DevFlowPet.app";

async function run(executable, args) {
  return execFile(executable, args, {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 300_000, shell: false,
  });
}

function plist(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.imotong.devflow.pet</string>
  <key>CFBundleExecutable</key><string>DevFlowPet</string>
  <key>CFBundleName</key><string>Dev Flow Desktop Pet</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleLocalizations</key><array><string>en</string><string>zh-Hans</string></array>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
`;
}

export async function verifyDesktopPet(application) {
  const contents = join(application, "Contents");
  const executable = join(contents, "MacOS", "DevFlowPet");
  const info = await stat(executable);
  if (!info.isFile() || (info.mode & 0o111) === 0) throw new Error("desktop pet executable is unavailable");
  const { stdout: architectures } = await run("/usr/bin/lipo", ["-archs", executable]);
  if (architectures.trim() !== "arm64") throw new Error(`unexpected desktop pet architecture: ${architectures.trim()}`);
  await run("/usr/bin/plutil", ["-lint", join(contents, "Info.plist")]);
  for (const locale of ["en", "zh-Hans"]) {
    await run("/usr/bin/plutil", ["-lint", join(contents, "Resources", `${locale}.lproj`, "InfoPlist.strings")]);
  }
  const assets = await checkAssetRoot(join(contents, "Resources"));
  if (!assets.ok) throw new Error(assets.problems.join("\n"));
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", application]);
  return { frames: assets.frames, asset_bytes: assets.bytes };
}

// Builds a local development package. Publication owns Developer ID signing and notarization.
export async function buildDesktopPetPackage({ outputRoot }) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("building the desktop pet requires macOS arm64 with Swift/Xcode");
  }
  if (!isAbsolute(outputRoot)) throw new Error("--output must be an absolute directory outside the repository");
  const output = resolve(outputRoot);
  if (output === repositoryRoot || output.startsWith(repositoryRoot + sep)) {
    throw new Error("--output must be outside the repository");
  }
  await mkdir(output, { recursive: true });
  const work = await mkdtemp(join(output, ".desktop-pet-build-"));
  try {
    const source = join(repositoryRoot, "packages", "dev-flow");
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    const stage = join(work, "package");
    for (const relative of manifest.files) {
      await mkdir(dirname(join(stage, relative)), { recursive: true });
      await copyFile(join(source, relative), join(stage, relative));
    }
    await chmod(join(stage, "bin", "dev-flow.mjs"), 0o755);
    await copyFile(join(repositoryRoot, "LICENSE"), join(stage, "LICENSE"));
    await writeFile(join(stage, "package.json"), `${JSON.stringify({
      ...manifest, files: [...manifest.files, applicationRelativePath],
    }, null, 2)}\n`);

    process.stdout.write("desktop-pet: compiling the macOS application\n");
    const buildArgs = ["build", "--package-path", join(repositoryRoot, "packages", "desktop-pet", "macos"),
      "--scratch-path", join(work, "swift"), "--configuration", "release", "--arch", "arm64"];
    await run("/usr/bin/xcrun", ["swift", ...buildArgs]);
    const { stdout: binPath } = await run("/usr/bin/xcrun", ["swift", ...buildArgs, "--show-bin-path"]);
    const application = join(stage, applicationRelativePath);
    const contents = join(application, "Contents");
    const resources = join(contents, "Resources");
    await mkdir(join(contents, "MacOS"), { recursive: true });
    await copyFile(join(binPath.trim(), "DevFlowPet"), join(contents, "MacOS", "DevFlowPet"));
    await chmod(join(contents, "MacOS", "DevFlowPet"), 0o755);
    await writeFile(join(contents, "Info.plist"), plist(manifest.version));
    process.stdout.write("desktop-pet: assembling the existing artwork and language resources\n");
    await bakeAssets(resources);
    for (const [locale, name] of [["en", "Dev Flow Desktop Pet"], ["zh-Hans", "Dev Flow 桌面宠物"]]) {
      const directory = join(resources, `${locale}.lproj`);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "InfoPlist.strings"), `"CFBundleDisplayName" = "${name}";\n`);
    }
    await run("/usr/bin/codesign", ["--force", "--sign", "-", "--timestamp=none", application]);
    await verifyDesktopPet(application);

    process.stdout.write("desktop-pet: packing and checking the extracted application\n");
    // npm packing resets non-bin executable modes. The existing archive helper
    // retains the native application's executable without adding another CLI bin.
    const archivePath = join(work, "package.tar");
    await run("/usr/bin/tar", ["-cf", archivePath, "--format", "ustar", "-C", work, "package"]);
    const archive = normalizeUstarArchive(await readFile(archivePath), new Set([
      "package/bin/dev-flow.mjs", `package/${applicationRelativePath}/Contents/MacOS/DevFlowPet`,
    ]));
    const tarball = join(output, `${manifest.name.replace(/^@/u, "").replaceAll("/", "-")}-${manifest.version}.tgz`);
    await writeFile(tarball, gzipSync(archive, { level: 9, mtime: 0 }), { mode: 0o644 });
    const extracted = join(work, "extracted");
    await mkdir(extracted);
    await run("/usr/bin/tar", ["-xzf", tarball, "-C", extracted]);
    const assets = await verifyDesktopPet(join(extracted, "package", applicationRelativePath));
    const result = {
      package: manifest.name, version: manifest.version, platform: "darwin-arm64", signing: "ad-hoc",
      tarball, sha256: createHash("sha256").update(await readFile(tarball)).digest("hex"), ...assets,
    };
    await writeFile(join(output, "desktop-pet-build.json"), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") {
    process.stderr.write("Usage: node scripts/build-desktop-pet.mjs --output <absolute-directory>\n");
    process.exitCode = 2;
  } else {
    buildDesktopPetPackage({ outputRoot: args[1] }).then(
      (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
      (error) => { process.stderr.write(`desktop-pet: ${error.stderr ?? error.message}\n`); process.exitCode = 1; },
    );
  }
}
