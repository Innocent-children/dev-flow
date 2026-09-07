import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { execPortableCommand } from "../packages/dev-flow/lib/command.mjs";
import { normalizeUstarArchive, stageAndPack } from "./dev-flow-local.mjs";
import { buildCoreRuntimes } from "./build-core-runtimes.mjs";
import {
  stageDefaultArtwork,
  verifyDefaultArtwork,
} from "./desktop-pet-artwork.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildWindowsDesktopPet({ outputRoot }) {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error("Windows x64 build host required");
  if (!isAbsolute(outputRoot))
    throw new Error(
      "--output must be an absolute directory outside the repository",
    );
  await mkdir(outputRoot, { recursive: true });
  const output = await realpath(outputRoot),
    repository = await realpath(root);
  const offset = relative(repository, output);
  if (!offset || (!offset.startsWith("..") && !isAbsolute(offset)))
    throw new Error("--output must be outside the repository");
  const work = await mkdtemp(join(output, ".windows-pet-build-"));
  try {
    const source = join(root, "packages", "desktop-pet", "windows");
    const manager = join(root, "packages", "dev-flow");
    const manifest = JSON.parse(
      await readFile(join(manager, "package.json"), "utf8"),
    );
    const packageRoot = join(work, "package");
    for (const file of manifest.files) {
      await mkdir(dirname(join(packageRoot, file)), { recursive: true });
      await copyFile(join(manager, file), join(packageRoot, file));
    }
    await copyFile(join(root, "LICENSE"), join(packageRoot, "LICENSE"));
    const runtimes = await buildCoreRuntimes({
      repositoryRoot: root,
      outputRoot: join(work, "core-runtimes"),
    });
    const artifactDirectory = join(work, "adapter-artifacts");
    await mkdir(artifactDirectory);
    await mkdir(join(packageRoot, "local-packages"));
    const devFlowLocalPackages = {};
    const coreArtifacts = new Map(Object.values(runtimes.runtimes).map(runtime => [runtime.relativePath, runtime]));
    for (const product of ["codex", "deepseek"]) {
      const artifact = await stageAndPack(product, {
        root,
        stageRoot: join(work, "adapter-stages"),
        outputRoot: artifactDirectory,
        coreArtifacts,
        run: (executable, args, options = {}) => execPortableCommand(executable, args, {
          cwd: options.cwd, env: options.environment ?? process.env,
          encoding: "utf8", windowsHide: true,
        }),
      });
      const bytes = await readFile(artifact.path);
      const relativePath = `local-packages/${product}.tgz`;
      await writeFile(join(packageRoot, relativePath), bytes);
      devFlowLocalPackages[product] = {
        path: relativePath, version: artifact.version,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }
    const applicationPath = "runtime/win32-x64/DevFlowPet";
    await writeFile(
      join(packageRoot, "package.json"),
      JSON.stringify(
        { ...manifest, devFlowLocalPackages, files: [...manifest.files, applicationPath, "local-packages/codex.tgz", "local-packages/deepseek.tgz"] },
        null,
        2,
      ) + "\n",
    );
    const application = join(packageRoot, applicationPath);
    await cp(join(source, "node_modules", "electron", "dist"), application, {
      recursive: true,
    });
    await rename(
      join(application, "electron.exe"),
      join(application, "DevFlowPet.exe"),
    );
    const appRoot = join(application, "resources", "app");
    await mkdir(appRoot, { recursive: true });
    for (const file of [
      "main.cjs",
      "storage.cjs",
      "appearance.cjs",
      "observation.cjs",
      "preload.cjs",
      "view.js",
      "view.html",
      "view.css",
      "decode.html",
    ])
      await copyFile(join(source, file), join(appRoot, file));
    for (const module of ["saxes", "xmlchars", "image-size"])
      await cp(
        join(source, "node_modules", module),
        join(appRoot, "node_modules", module),
        { recursive: true },
      );
    await writeFile(
      join(appRoot, "package.json"),
      JSON.stringify({
        name: "dev-flow-desktop-pet-windows",
        productName: "Dev Flow Desktop Pet",
        version: manifest.version,
        main: "main.cjs",
        private: true,
      }) + "\n",
    );
    await stageDefaultArtwork(join(appRoot, "default-appearance"));
    const assets = await verifyDefaultArtwork(
      join(appRoot, "default-appearance"),
    );
    const archive = join(work, "package.tar");
    await execPortableCommand(
      "tar",
      ["-cf", archive, "--format", "ustar", "-C", work, "package"],
      { windowsHide: true },
    );
    const tarball = join(
      output,
      `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}-windows-pet.tgz`,
    );
    await writeFile(
      tarball,
      gzipSync(
        normalizeUstarArchive(
          await readFile(archive),
          new Set(["package/bin/dev-flow.mjs"]),
        ),
        { level: 9, mtime: 0 },
      ),
    );
    const extracted = join(output, "extracted");
    await mkdir(extracted, { recursive: true });
    await execPortableCommand("tar", ["-xzf", tarball, "-C", extracted], {
      windowsHide: true,
    });
    const extractedApp = join(extracted, "package", applicationPath);
    await verifyDefaultArtwork(
      join(extractedApp, "resources", "app", "default-appearance"),
    );
    if (
      !(await readFile(join(extractedApp, "DevFlowPet.exe"))).equals(
        await readFile(join(application, "DevFlowPet.exe")),
      )
    )
      throw new Error("Extracted executable differs from build");
    const result = {
      package: manifest.name,
      version: manifest.version,
      platform: "win32-x64",
      signing: "unsigned-local-development",
      tarball,
      executable: join(extractedApp, "DevFlowPet.exe"),
      sha256: createHash("sha256")
        .update(await readFile(tarball))
        .digest("hex"),
      ...assets,
    };
    await writeFile(
      join(output, "desktop-pet-build.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    return result;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 4 || process.argv[2] !== "--output")
    throw new Error(
      "Usage: node scripts/build-desktop-pet-windows.mjs --output <absolute-directory>",
    );
  buildWindowsDesktopPet({ outputRoot: process.argv[3] }).then(
    (result) => console.log(JSON.stringify(result)),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
