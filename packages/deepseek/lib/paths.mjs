import { chmod, lstat, mkdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIRECTORY_ENVIRONMENT = "DEV_FLOW_DATA_DIR";

export function packageRootFromModule(moduleUrl = import.meta.url) {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}

export async function resolveDataDirectory({
  homeDirectory = homedir(),
  environment = process.env,
} = {}) {
  const canonicalHome = await canonicalExistingDirectory(homeDirectory, "home directory");
  const productSupportRoot = containedPath(
    canonicalHome,
    join(canonicalHome, "Library", "Application Support", "dev-flow"),
    "product support root",
  );
  await assertNoSymlinkComponents(canonicalHome, productSupportRoot);

  const explicitDataDirectory = environment?.[DATA_DIRECTORY_ENVIRONMENT] ?? "";
  if (explicitDataDirectory !== "") {
    const dataDirectory = await canonicalExplicitDataDirectory(explicitDataDirectory);
    return Object.freeze({
      dataDirectory,
      homeDirectory: canonicalHome,
      productSupportRoot,
      usesDefaultDataDirectory: false,
    });
  }

  return Object.freeze({
    dataDirectory: containedPath(
      productSupportRoot,
      join(productSupportRoot, "data"),
      "default data directory",
    ),
    homeDirectory: canonicalHome,
    productSupportRoot,
    usesDefaultDataDirectory: true,
  });
}

export async function ensureDefaultDataDirectory(paths) {
  if (!paths?.usesDefaultDataDirectory) {
    throw new Error("refusing to create an explicit data directory");
  }
  const expected = containedPath(
    paths.productSupportRoot,
    join(paths.productSupportRoot, "data"),
    "default data directory",
  );
  if (paths.dataDirectory !== expected) {
    throw new Error("default data directory does not match the shared product path");
  }

  await assertNoSymlinkComponents(paths.homeDirectory, paths.productSupportRoot);
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 });
  await assertNoSymlinkComponents(paths.homeDirectory, paths.dataDirectory);
  await chmod(paths.dataDirectory, 0o700);
  return paths.dataDirectory;
}

export function containedPath(root, candidate, label = "path") {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = resolve(candidate);
  const offset = relative(canonicalRoot, canonicalCandidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error(`${label} escapes its owned root`);
  }
  return canonicalCandidate;
}

async function canonicalExplicitDataDirectory(path) {
  if (!isAbsolute(path)) {
    throw new Error(`${DATA_DIRECTORY_ENVIRONMENT} must be an absolute path`);
  }
  const normalized = resolve(path);
  const canonical = await canonicalExistingDirectory(path, DATA_DIRECTORY_ENVIRONMENT);
  if (canonical !== normalized) {
    throw new Error(`${DATA_DIRECTORY_ENVIRONMENT} must be canonical and may not use a symbolic link`);
  }
  return canonical;
}

async function canonicalExistingDirectory(path, label) {
  if (!isAbsolute(path)) {
    throw new Error(`${label} must be absolute`);
  }
  try {
    const canonical = await realpath(path);
    const info = await stat(canonical);
    if (!info.isDirectory()) throw new Error("not a directory");
    return canonical;
  } catch (error) {
    throw new Error(`${label} must name an existing directory`, { cause: error });
  }
}

async function assertNoSymlinkComponents(root, candidate) {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = containedPath(canonicalRoot, candidate, "product path");
  const components = relative(canonicalRoot, canonicalCandidate).split(sep).filter(Boolean);
  let current = canonicalRoot;
  for (const component of components) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new Error(`product path contains a symbolic link: ${current}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}
