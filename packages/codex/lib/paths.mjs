import { chmod, lstat, mkdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIRECTORY_ENVIRONMENT = "DEV_FLOW_DATA_DIR";
export const SUPPORTED_RUNTIME_KEY = "darwin-arm64";

export function packageRootFromModule(moduleUrl = import.meta.url) {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}

export async function resolveProductPaths({
  packageRoot = packageRootFromModule(),
  homeDirectory = homedir(),
  platform = process.platform,
  arch = process.arch,
  environment = process.env,
} = {}) {
  const runtimeKey = `${platform}-${arch}`;
  if (runtimeKey !== SUPPORTED_RUNTIME_KEY) {
    throw new Error(`unsupported platform ${runtimeKey}; Feature 003 supports ${SUPPORTED_RUNTIME_KEY}`);
  }

  const canonicalPackageRoot = await canonicalExistingDirectory(packageRoot, "package root");
  const canonicalHome = await canonicalExistingDirectory(homeDirectory, "home directory");
  const productSupportRoot = join(
    canonicalHome,
    "Library",
    "Application Support",
    "dev-flow",
  );
  await assertNoSymlinkComponents(canonicalHome, productSupportRoot);

  const runtimePath = containedPath(
    canonicalPackageRoot,
    join(canonicalPackageRoot, "runtime", runtimeKey, "dev-flow"),
    "runtime",
  );
  const pluginRoot = containedPath(
    canonicalPackageRoot,
    join(canonicalPackageRoot, "plugin"),
    "plugin",
  );
  const registrationsDirectory = containedPath(
    productSupportRoot,
    join(productSupportRoot, "registrations"),
    "registration directory",
  );
  const receiptPath = containedPath(
    productSupportRoot,
    join(registrationsDirectory, "codex.json"),
    "receipt",
  );

  const explicitDataDirectory = environment?.[DATA_DIRECTORY_ENVIRONMENT] ?? "";
  let dataDirectory;
  let usesDefaultDataDirectory;
  if (explicitDataDirectory !== "") {
    if (!isAbsolute(explicitDataDirectory)) {
      throw new Error(`${DATA_DIRECTORY_ENVIRONMENT} must be an absolute path`);
    }
    const normalized = resolve(explicitDataDirectory);
    let canonical;
    try {
      canonical = await realpath(explicitDataDirectory);
      const info = await stat(canonical);
      if (!info.isDirectory()) {
        throw new Error("not a directory");
      }
    } catch (error) {
      throw new Error(`${DATA_DIRECTORY_ENVIRONMENT} must name an existing directory`, {
        cause: error,
      });
    }
    if (canonical !== normalized) {
      throw new Error(`${DATA_DIRECTORY_ENVIRONMENT} must be canonical and may not use a symbolic link`);
    }
    dataDirectory = canonical;
    usesDefaultDataDirectory = false;
  } else {
    dataDirectory = containedPath(
      productSupportRoot,
      join(productSupportRoot, "data"),
      "default data directory",
    );
    usesDefaultDataDirectory = true;
  }

  return Object.freeze({
    packageRoot: canonicalPackageRoot,
    marketplaceRoot: canonicalPackageRoot,
    pluginRoot,
    runtimePath,
    homeDirectory: canonicalHome,
    productSupportRoot,
    registrationsDirectory,
    receiptPath,
    dataDirectory,
    usesDefaultDataDirectory,
    runtimeKey,
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
    throw new Error("default data directory does not match the product-owned path");
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

async function canonicalExistingDirectory(path, label) {
  if (!isAbsolute(path)) {
    throw new Error(`${label} must be absolute`);
  }
  let canonical;
  try {
    canonical = await realpath(path);
    const info = await stat(canonical);
    if (!info.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch (error) {
    throw new Error(`${label} must name an existing directory`, { cause: error });
  }
  return canonical;
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
      if (error?.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
