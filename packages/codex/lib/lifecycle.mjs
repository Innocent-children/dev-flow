import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { containedPath } from "./paths.mjs";

const execFile = promisify(execFileCallback);

export const CODEX_COMPATIBILITY_RANGE = ">=0.147.0 <0.148.0";
export const MARKETPLACE_NAME = "dev-flow-local";
export const PLUGIN_NAME = "dev-flow-codex";
export const PLUGIN_SELECTOR = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const digestPattern = /^[0-9a-f]{64}$/;

export async function runCodexJSON(
  arguments_,
  {
    codexExecutable = "codex",
    environment = process.env,
    currentDirectory = process.cwd(),
  } = {},
) {
  if (!Array.isArray(arguments_) || arguments_.some((argument) => typeof argument !== "string" || argument.includes("\0"))) {
    throw new Error("Codex arguments must be a closed string array");
  }
  let stdout;
  try {
    ({ stdout } = await execFile(codexExecutable, arguments_, {
      cwd: currentDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    const detail = String(error?.stderr ?? "").trim();
    throw new Error(
      `Codex command failed (${arguments_.join(" ")})${detail ? `: ${detail}` : ""}`,
      { cause: error },
    );
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Codex command did not return valid JSON (${arguments_.join(" ")})`, {
      cause: error,
    });
  }
}

export async function inspectCoreVersion(
  runtimePath,
  {
    environment = process.env,
    currentDirectory = dirname(runtimePath),
  } = {},
) {
  await assertExecutableFile(runtimePath, "packaged Core");
  let stdout;
  try {
    ({ stdout } = await execFile(runtimePath, ["version"], {
      cwd: currentDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    throw new Error("packaged Core version preflight failed", { cause: error });
  }
  const match = /^dev-flow (\S+)\n?$/.exec(stdout);
  if (!match) throw new Error("packaged Core returned an invalid version line");
  parseSemver(match[1], "packaged Core version");
  return match[1];
}

export async function setupRegistration({
  paths,
  packageVersion,
  codexExecutable = "codex",
  environment = process.env,
  now = () => new Date(),
} = {}) {
  const preflight = await preflightSetup({
    paths,
    packageVersion,
    codexExecutable,
    environment,
  });
  const commandOptions = {
    codexExecutable,
    environment,
    currentDirectory: paths.packageRoot,
  };
  const existingReceipt = await readReceipt(paths.receiptPath);
  const initialState = await readRegistrationState(commandOptions);
  const expectedReceipt = createReceipt({
    paths,
    packageVersion: preflight.packageVersion,
    coreVersion: preflight.coreVersion,
    codexVersion: preflight.codexVersion,
    resourceDigests: preflight.resourceDigests,
    installedAt: now().toISOString(),
  });

  if (existingReceipt) {
    if (!receiptOwnershipMatches(existingReceipt, expectedReceipt)) {
      throw new Error("registration receipt ownership conflict; setup made no changes");
    }
    assertMatchingRegistrationState(initialState, paths, preflight.packageVersion);
    return {
      status: "already-installed",
      changed: false,
      receipt: existingReceipt,
    };
  }

  assertRegistrationAbsent(initialState, paths);
  let marketplaceCreated = false;
  try {
    await runCodexJSON(
      ["plugin", "marketplace", "add", paths.marketplaceRoot, "--json"],
      commandOptions,
    );
    marketplaceCreated = true;
    await runCodexJSON(
      ["plugin", "add", PLUGIN_SELECTOR, "--json"],
      commandOptions,
    );
    const finalState = await readRegistrationState(commandOptions);
    assertMatchingRegistrationState(finalState, paths, preflight.packageVersion);
    await writeReceiptAtomic(paths.receiptPath, expectedReceipt, {
      ownedRoot: paths.productSupportRoot,
    });
    return {
      status: "installed",
      changed: true,
      receipt: expectedReceipt,
    };
  } catch (error) {
    if (marketplaceCreated) {
      const rollback = await rollbackCreatedMarketplace(paths, commandOptions);
      if (rollback.error) {
        throw new Error(
          `setup failed and bounded marketplace rollback could not complete: ${rollback.error.message}`,
          { cause: error },
        );
      }
    }
    throw error;
  }
}

export async function removeRegistration({
  paths,
  packageVersion,
  codexExecutable = "codex",
  environment = process.env,
} = {}) {
  const commandOptions = {
    codexExecutable,
    environment,
    currentDirectory: paths.packageRoot,
  };
  await assertNoSymbolicLinkComponents(paths.productSupportRoot, dirname(paths.receiptPath));
  await rejectSymbolicLink(paths.receiptPath);
  const receipt = await readReceipt(paths.receiptPath);
  let state = await readRegistrationState(commandOptions);

  if (!receipt) {
    assertRegistrationAbsent(state, paths);
    return { status: "already-absent", changed: false };
  }

  assertRemovalReceipt(receipt, paths, packageVersion);
  let owned = reconcileRemovalState(state, receipt);

  if (owned.plugin) {
    await runCodexJSON(
      ["plugin", "remove", receipt.registration.plugin_selector, "--json"],
      commandOptions,
    );
    state = await readRegistrationState(commandOptions);
    owned = reconcileRemovalState(state, receipt);
    if (owned.plugin) throw new Error("Codex plugin remains after removal readback");
  }

  if (owned.marketplace) {
    await runCodexJSON(
      ["plugin", "marketplace", "remove", receipt.registration.marketplace_name, "--json"],
      commandOptions,
    );
    state = await readRegistrationState(commandOptions);
    owned = reconcileRemovalState(state, receipt);
    if (owned.marketplace) throw new Error("Codex marketplace remains after removal readback");
    if (owned.plugin) throw new Error("Codex plugin reappeared during marketplace removal");
  }

  try {
    await unlink(paths.receiptPath);
  } catch (error) {
    throw new Error(`delete exact registration receipt ${paths.receiptPath}: ${error.message}`, {
      cause: error,
    });
  }
  if (await readReceipt(paths.receiptPath)) {
    throw new Error("registration receipt remains after exact cleanup");
  }
  return { status: "removed", changed: true };
}

async function preflightSetup({ paths, packageVersion, codexExecutable, environment }) {
  assertObject(paths, "product paths");
  if (paths.runtimeKey !== "darwin-arm64") {
    throw new Error(`unsupported platform ${paths.runtimeKey ?? "unknown"}; Feature 003 supports darwin-arm64`);
  }
  parseSemver(packageVersion, "package version");
  await assertPackageResources(paths, packageVersion);
  const launcherPath = await assertExecutableOnPath("dev-flow-codex", environment?.PATH ?? "");
  const expectedLauncherPath = join(paths.packageRoot, "bin", "dev-flow-codex.mjs");
  let canonicalLauncher;
  let canonicalExpectedLauncher;
  try {
    [canonicalLauncher, canonicalExpectedLauncher] = await Promise.all([
      realpath(launcherPath),
      realpath(expectedLauncherPath),
    ]);
  } catch (error) {
    throw new Error("resolve the package-owned dev-flow-codex launcher on PATH", { cause: error });
  }
  if (canonicalLauncher !== canonicalExpectedLauncher) {
    throw new Error("dev-flow-codex on PATH does not resolve to this installed package");
  }
  const coreVersion = await inspectCoreVersion(paths.runtimePath, {
    environment,
    currentDirectory: paths.packageRoot,
  });
  if (coreVersion !== packageVersion) {
    throw new Error(`packaged Core version ${coreVersion} does not match package version ${packageVersion}`);
  }
  const codexVersion = await inspectCodexVersion(codexExecutable, {
    environment,
    currentDirectory: paths.packageRoot,
  });
  if (!versionSatisfiesRange(codexVersion)) {
    throw new Error(`Codex version ${codexVersion} does not satisfy ${CODEX_COMPATIBILITY_RANGE}`);
  }
  return {
    packageVersion,
    coreVersion,
    codexVersion,
    resourceDigests: await digestResources(resourcePaths(paths)),
  };
}

async function inspectCodexVersion(codexExecutable, { environment, currentDirectory }) {
  let stdout;
  try {
    ({ stdout } = await execFile(codexExecutable, ["--version"], {
      cwd: currentDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    throw new Error("Codex version preflight failed", { cause: error });
  }
  const match = /^codex(?:-cli)? (\S+)\n?$/.exec(stdout);
  if (!match) throw new Error("Codex returned an invalid version line");
  parseSemver(match[1], "Codex version");
  return match[1];
}

async function assertPackageResources(paths, packageVersion) {
  const packageManifest = await readJSON(join(paths.packageRoot, "package.json"), "package manifest");
  if (packageManifest.name !== PLUGIN_NAME || packageManifest.private !== true) {
    throw new Error("package manifest has the wrong private product identity");
  }
  if (packageManifest.version !== packageVersion) {
    throw new Error("package manifest version does not match the requested package version");
  }

  const marketplace = await readJSON(
    join(paths.marketplaceRoot, ".agents", "plugins", "marketplace.json"),
    "marketplace catalog",
  );
  if (marketplace.name !== MARKETPLACE_NAME || !Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    throw new Error("marketplace catalog must contain exactly the Dev Flow marketplace entry");
  }
  const marketplacePlugin = marketplace.plugins[0];
  if (
    marketplacePlugin?.name !== PLUGIN_NAME ||
    marketplacePlugin?.source?.source !== "local" ||
    marketplacePlugin?.source?.path !== "./plugin"
  ) {
    throw new Error("marketplace catalog has an invalid local plugin source");
  }

  const pluginManifest = await readJSON(
    join(paths.pluginRoot, ".codex-plugin", "plugin.json"),
    "plugin manifest",
  );
  if (
    pluginManifest.name !== PLUGIN_NAME ||
    pluginManifest.version !== packageVersion ||
    pluginManifest.skills !== "./skills/" ||
    pluginManifest.mcpServers !== "./.mcp.json"
  ) {
    throw new Error("plugin manifest identity or resource paths do not match the package");
  }

  const mcpConfiguration = await readJSON(
    join(paths.pluginRoot, ".mcp.json"),
    "MCP configuration",
  );
  assertObject(mcpConfiguration.mcpServers, "MCP servers");
  assertExactKeys(mcpConfiguration.mcpServers, ["dev-flow"], "MCP servers");
  const server = mcpConfiguration.mcpServers["dev-flow"];
  assertObject(server, "Dev Flow MCP server");
  assertExactKeys(server, ["command", "args"], "Dev Flow MCP server");
  if (server.command !== "dev-flow-codex" || stableJSON(server.args) !== stableJSON(["mcp"])) {
    throw new Error("Dev Flow MCP server must invoke exactly dev-flow-codex mcp");
  }

  const skillPath = join(paths.pluginRoot, "skills", "dev-flow", "SKILL.md");
  let skill;
  try {
    skill = await readFile(skillPath, "utf8");
  } catch (error) {
    throw new Error("Dev Flow Skill is unavailable", { cause: error });
  }
  if (skill.trim() === "") throw new Error("Dev Flow Skill must be non-empty");
}

async function readRegistrationState(commandOptions) {
  const marketplaces = await runCodexJSON(
    ["plugin", "marketplace", "list", "--json"],
    commandOptions,
  );
  const plugins = await runCodexJSON(["plugin", "list", "--json"], commandOptions);
  if (!Array.isArray(marketplaces)) throw new Error("Codex marketplace readback must be an array");
  if (!Array.isArray(plugins)) throw new Error("Codex plugin readback must be an array");
  return { marketplaces, plugins };
}

function assertRegistrationAbsent(state, paths) {
  const marketplaceCollision = state.marketplaces.find(
    (entry) => entry?.name === MARKETPLACE_NAME || entry?.root === paths.marketplaceRoot,
  );
  if (marketplaceCollision) {
    throw new Error("marketplace ownership conflict without a matching registration receipt");
  }
  const pluginCollision = state.plugins.find(
    (entry) =>
      entry?.name === PLUGIN_NAME ||
      entry?.selector === PLUGIN_SELECTOR ||
      entry?.root === paths.pluginRoot,
  );
  if (pluginCollision) {
    throw new Error("plugin ownership conflict without a matching registration receipt");
  }
}

function assertRemovalReceipt(receipt, paths, packageVersion) {
  const matches =
    receipt.product.version === packageVersion &&
    receipt.product.core_version === packageVersion &&
    receipt.registration.marketplace_name === MARKETPLACE_NAME &&
    receipt.registration.marketplace_root === paths.marketplaceRoot &&
    receipt.registration.plugin_name === PLUGIN_NAME &&
    receipt.registration.plugin_selector === PLUGIN_SELECTOR &&
    receipt.registration.plugin_root === paths.pluginRoot &&
    receipt.paths.package_root === paths.packageRoot &&
    receipt.paths.runtime_path === paths.runtimePath &&
    receipt.paths.data_dir === paths.dataDirectory &&
    receipt.paths.receipt_path === paths.receiptPath;
  if (!matches) {
    throw new Error("registration receipt ownership conflict; removal made no changes");
  }
}

function reconcileRemovalState(state, receipt) {
  const matchingMarketplaces = state.marketplaces.filter(
    (entry) =>
      entry?.name === receipt.registration.marketplace_name ||
      entry?.root === receipt.registration.marketplace_root,
  );
  if (matchingMarketplaces.length > 1) {
    throw new Error("Codex marketplace ownership conflict during removal");
  }
  const marketplace = matchingMarketplaces[0] ?? null;
  if (marketplace) {
    assertObject(marketplace, "marketplace removal readback");
    assertExactKeys(marketplace, ["name", "source", "root"], "marketplace removal readback");
    if (
      marketplace.name !== receipt.registration.marketplace_name ||
      marketplace.root !== receipt.registration.marketplace_root ||
      resolve(marketplace.source) !== receipt.registration.marketplace_root
    ) {
      throw new Error("Codex marketplace readback conflicts with the recorded removal root");
    }
  }

  const matchingPlugins = state.plugins.filter(
    (entry) =>
      entry?.name === receipt.registration.plugin_name ||
      entry?.selector === receipt.registration.plugin_selector ||
      entry?.root === receipt.registration.plugin_root,
  );
  if (matchingPlugins.length > 1) {
    throw new Error("Codex plugin ownership conflict during removal");
  }
  const plugin = matchingPlugins[0] ?? null;
  if (plugin) {
    assertObject(plugin, "plugin removal readback");
    assertExactKeys(
      plugin,
      ["name", "marketplace_name", "selector", "root", "source", "version", "installed", "enabled"],
      "plugin removal readback",
    );
    assertObject(plugin.source, "plugin removal source");
    assertExactKeys(plugin.source, ["source", "path"], "plugin removal source");
    if (
      plugin.name !== receipt.registration.plugin_name ||
      plugin.marketplace_name !== receipt.registration.marketplace_name ||
      plugin.selector !== receipt.registration.plugin_selector ||
      plugin.root !== receipt.registration.plugin_root ||
      plugin.version !== receipt.product.version ||
      plugin.installed !== true ||
      typeof plugin.enabled !== "boolean" ||
      plugin.source.source !== "local" ||
      plugin.source.path !== "./plugin"
    ) {
      throw new Error("Codex plugin readback conflicts with the recorded removal identity");
    }
  }

  return { marketplace, plugin };
}

function assertMatchingRegistrationState(state, paths, packageVersion) {
  const matchingMarketplaces = state.marketplaces.filter(
    (entry) => entry?.name === MARKETPLACE_NAME || entry?.root === paths.marketplaceRoot,
  );
  if (matchingMarketplaces.length !== 1) {
    throw new Error("Codex readback must contain exactly one Dev Flow marketplace identity");
  }
  const marketplace = matchingMarketplaces[0];
  assertObject(marketplace, "marketplace readback");
  assertExactKeys(marketplace, ["name", "source", "root"], "marketplace readback");
  if (marketplace.root !== paths.marketplaceRoot || resolve(marketplace.source) !== paths.marketplaceRoot) {
    throw new Error("Codex marketplace readback conflicts with the package root");
  }

  const matchingPlugins = state.plugins.filter(
    (entry) => entry?.name === PLUGIN_NAME || entry?.selector === PLUGIN_SELECTOR || entry?.root === paths.pluginRoot,
  );
  if (matchingPlugins.length !== 1) {
    throw new Error("Codex readback must contain exactly one Dev Flow plugin identity");
  }
  const plugin = matchingPlugins[0];
  assertObject(plugin, "plugin readback");
  assertExactKeys(
    plugin,
    ["name", "marketplace_name", "selector", "root", "source", "version", "installed", "enabled"],
    "plugin readback",
  );
  if (
    plugin.name !== PLUGIN_NAME ||
    plugin.marketplace_name !== MARKETPLACE_NAME ||
    plugin.root !== paths.pluginRoot ||
    plugin.version !== packageVersion ||
    plugin.installed !== true ||
    plugin.enabled !== true ||
    plugin.source?.source !== "local" ||
    plugin.source?.path !== "./plugin"
  ) {
    throw new Error("Codex plugin readback conflicts with the expected installed plugin");
  }
}

async function rollbackCreatedMarketplace(paths, commandOptions) {
  try {
    const state = await readRegistrationState(commandOptions);
    if (state.plugins.some((entry) => entry?.name === PLUGIN_NAME || entry?.selector === PLUGIN_SELECTOR)) {
      return { preserved: true };
    }
    const marketplace = state.marketplaces.find((entry) => entry?.name === MARKETPLACE_NAME);
    if (!marketplace || marketplace.root !== paths.marketplaceRoot) return { preserved: true };
    await runCodexJSON(
      ["plugin", "marketplace", "remove", MARKETPLACE_NAME, "--json"],
      commandOptions,
    );
    const after = await runCodexJSON(
      ["plugin", "marketplace", "list", "--json"],
      commandOptions,
    );
    if (!Array.isArray(after) || after.some((entry) => entry?.name === MARKETPLACE_NAME)) {
      throw new Error("marketplace remains after rollback readback");
    }
    return { removed: true };
  } catch (error) {
    return { error };
  }
}

function createReceipt({
  paths,
  packageVersion,
  coreVersion,
  codexVersion,
  resourceDigests,
  installedAt,
}) {
  return validateReceipt({
    schema_version: 2,
    product: {
      name: PLUGIN_NAME,
      version: packageVersion,
      core_version: coreVersion,
      codex_compatibility: CODEX_COMPATIBILITY_RANGE,
    },
    host: {
      surface: "codex-cli",
      version: codexVersion,
      os: "darwin",
      arch: "arm64",
    },
    registration: {
      marketplace_name: MARKETPLACE_NAME,
      marketplace_root: paths.marketplaceRoot,
      plugin_name: PLUGIN_NAME,
      plugin_selector: PLUGIN_SELECTOR,
      plugin_root: paths.pluginRoot,
    },
    paths: {
      package_root: paths.packageRoot,
      runtime_path: paths.runtimePath,
      data_dir: paths.dataDirectory,
      receipt_path: paths.receiptPath,
    },
    resource_digests: resourceDigests,
    installed_at: installedAt,
  });
}

function resourcePaths(paths) {
  return {
    pluginManifest: join(paths.pluginRoot, ".codex-plugin", "plugin.json"),
    skill: join(paths.pluginRoot, "skills", "dev-flow", "SKILL.md"),
    mcpConfiguration: join(paths.pluginRoot, ".mcp.json"),
  };
}

async function assertExecutableFile(path, label) {
  let info;
  try {
    info = await stat(path);
    await access(path, fsConstants.X_OK);
  } catch (error) {
    throw new Error(`${label} must exist and be executable`, { cause: error });
  }
  if (!info.isFile() || (info.mode & 0o111) === 0) {
    throw new Error(`${label} must exist and be executable`);
  }
}

async function assertExecutableOnPath(name, pathValue) {
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = join(directory, name);
    try {
      await assertExecutableFile(candidate, name);
      return candidate;
    } catch {
      // Continue through the closed PATH list.
    }
  }
  throw new Error(`${name} must be executable and discoverable on PATH`);
}

async function readJSON(path, label) {
  let contents;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`${label} is unavailable at ${path}`, { cause: error });
  }
  try {
    const parsed = JSON.parse(contents);
    assertObject(parsed, label);
    return parsed;
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

export function versionSatisfiesRange(version, range = CODEX_COMPATIBILITY_RANGE) {
  const match = /^>=(\S+)\s+<(\S+)$/.exec(range);
  if (!match) throw new Error(`unsupported compatibility range ${JSON.stringify(range)}`);
  const candidate = parseSemver(version, "Codex version");
  const minimum = parseSemver(match[1], "compatibility minimum");
  const maximum = parseSemver(match[2], "compatibility maximum");
  return compareSemver(candidate, minimum) >= 0 && compareSemver(candidate, maximum) < 0;
}

export function validateReceipt(receipt, { compatibilityRange = CODEX_COMPATIBILITY_RANGE } = {}) {
  assertObject(receipt, "registration receipt");
  assertExactKeys(
    receipt,
    ["schema_version", "product", "host", "registration", "paths", "resource_digests", "installed_at"],
    "registration receipt",
  );
  if (receipt.schema_version !== 2) throw new Error("registration receipt schema_version must equal 2");

  assertObject(receipt.product, "product");
  assertExactKeys(receipt.product, ["name", "version", "core_version", "codex_compatibility"], "product");
  assertEqual(receipt.product.name, "dev-flow-codex", "product.name");
  parseSemver(receipt.product.version, "product.version");
  parseSemver(receipt.product.core_version, "product.core_version");
  assertEqual(receipt.product.core_version, receipt.product.version, "product Core version");
  assertEqual(receipt.product.codex_compatibility, compatibilityRange, "product compatibility range");

  assertObject(receipt.host, "host");
  assertExactKeys(receipt.host, ["surface", "version", "os", "arch"], "host");
  assertEqual(receipt.host.surface, "codex-cli", "host.surface");
  assertEqual(receipt.host.os, "darwin", "host.os");
  assertEqual(receipt.host.arch, "arm64", "host.arch");
  if (!versionSatisfiesRange(receipt.host.version, compatibilityRange)) {
    throw new Error(`host.version ${receipt.host.version} does not satisfy ${compatibilityRange}`);
  }

  assertObject(receipt.registration, "registration");
  assertExactKeys(
    receipt.registration,
    ["marketplace_name", "marketplace_root", "plugin_name", "plugin_selector", "plugin_root"],
    "registration",
  );
  assertEqual(receipt.registration.marketplace_name, "dev-flow-local", "registration.marketplace_name");
  assertEqual(receipt.registration.plugin_name, "dev-flow-codex", "registration.plugin_name");
  assertEqual(
    receipt.registration.plugin_selector,
    "dev-flow-codex@dev-flow-local",
    "registration.plugin_selector",
  );
  assertCanonicalAbsolutePath(receipt.registration.marketplace_root, "registration.marketplace_root");
  assertCanonicalAbsolutePath(receipt.registration.plugin_root, "registration.plugin_root");

  assertObject(receipt.paths, "paths");
  assertExactKeys(receipt.paths, ["package_root", "runtime_path", "data_dir", "receipt_path"], "paths");
  for (const field of ["package_root", "runtime_path", "data_dir", "receipt_path"]) {
    assertCanonicalAbsolutePath(receipt.paths[field], `paths.${field}`);
  }

  assertObject(receipt.resource_digests, "resource_digests");
  assertExactKeys(
    receipt.resource_digests,
    ["plugin_manifest", "skill", "mcp_configuration"],
    "resource_digests",
  );
  for (const field of ["plugin_manifest", "skill", "mcp_configuration"]) {
    if (!digestPattern.test(receipt.resource_digests[field])) {
      throw new Error(`resource_digests.${field} must be a lowercase SHA-256 digest`);
    }
  }

  if (typeof receipt.installed_at !== "string" || !Number.isFinite(Date.parse(receipt.installed_at))) {
    throw new Error("installed_at must be an RFC 3339 date-time string");
  }
  return structuredClone(receipt);
}

export async function readReceipt(receiptPath, options) {
  let contents;
  try {
    contents = await readFile(receiptPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`read registration receipt ${receiptPath}: ${error.message}`, { cause: error });
  }

  let receipt;
  try {
    receipt = JSON.parse(contents);
  } catch (error) {
    throw new Error(`parse registration receipt ${receiptPath}: invalid JSON`, { cause: error });
  }
  try {
    return validateReceipt(receipt, options);
  } catch (error) {
    throw new Error(`registration receipt ${receiptPath} is invalid: ${error.message}`, { cause: error });
  }
}

export async function writeReceiptAtomic(receiptPath, receipt, { ownedRoot, compatibilityRange } = {}) {
  if (!ownedRoot) throw new Error("receipt owned root is required");
  assertCanonicalAbsolutePath(receiptPath, "receipt path");
  assertCanonicalAbsolutePath(ownedRoot, "receipt owned root");
  const expectedPath = join(ownedRoot, "registrations", "codex.json");
  if (receiptPath !== expectedPath) {
    throw new Error(`receipt path must equal the product-owned path ${expectedPath}`);
  }
  containedPath(ownedRoot, receiptPath, "receipt path");

  const validated = validateReceipt(receipt, { compatibilityRange });
  if (validated.paths.receipt_path !== receiptPath) {
    throw new Error("receipt payload path does not match the write target");
  }

  await mkdir(ownedRoot, { recursive: true, mode: 0o700 });
  const canonicalOwnedRoot = await realpath(ownedRoot);
  if (canonicalOwnedRoot !== ownedRoot) {
    throw new Error("receipt owned root must be canonical and may not use a symbolic link");
  }
  const parent = dirname(receiptPath);
  await assertNoSymbolicLinkComponents(ownedRoot, parent);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await assertNoSymbolicLinkComponents(ownedRoot, parent);
  await chmod(parent, 0o700);
  await rejectSymbolicLink(receiptPath);

  const temporaryPath = join(parent, `.${basename(receiptPath)}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, receiptPath);
    await chmod(receiptPath, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function digestResources({ pluginManifest, skill, mcpConfiguration }) {
  const entries = {
    plugin_manifest: pluginManifest,
    skill,
    mcp_configuration: mcpConfiguration,
  };
  const result = {};
  for (const [name, path] of Object.entries(entries)) {
    if (!path) throw new Error(`resource path ${name} is required`);
    result[name] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return result;
}

export function receiptOwnershipMatches(left, right) {
  try {
    const first = validateReceipt(left);
    const second = validateReceipt(right);
    return stableJSON(ownershipProjection(first)) === stableJSON(ownershipProjection(second));
  } catch {
    return false;
  }
}

function ownershipProjection(receipt) {
  return {
    schema_version: receipt.schema_version,
    product: receipt.product,
    host: receipt.host,
    registration: receipt.registration,
    paths: receipt.paths,
    resource_digests: receipt.resource_digests,
  };
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value, requiredKeys, label) {
  for (const field of requiredKeys) {
    if (!Object.hasOwn(value, field)) throw new Error(`${label} missing field ${field}`);
  }
  const allowed = new Set(requiredKeys);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} has unexpected field ${field}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
  }
}

function assertCanonicalAbsolutePath(value, label) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
  if (resolve(value) !== value) throw new Error(`${label} must be canonical`);
}

function parseSemver(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a SemVer string`);
  const match = semverPattern.exec(value);
  if (!match) throw new Error(`${label} must be valid SemVer`);
  const prerelease = match[4] ? match[4].split(".") : [];
  for (const identifier of prerelease) {
    if (/^[0-9]+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0")) {
      throw new Error(`${label} has an invalid numeric prerelease identifier`);
    }
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

function compareSemver(left, right) {
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) return left[field] < right[field] ? -1 : 1;
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  const count = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^[0-9]+$/.test(a);
    const bNumeric = /^[0-9]+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) < Number(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

async function assertNoSymbolicLinkComponents(root, candidate) {
  const offset = relative(root, candidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error("receipt path escapes its owned root");
  }
  let current = root;
  for (const component of offset.split(sep).filter(Boolean)) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`receipt path contains a symbolic link: ${current}`);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

async function rejectSymbolicLink(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) {
      throw new Error(`receipt target is a symbolic link: ${path}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
