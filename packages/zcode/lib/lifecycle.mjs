import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { core, paths } from "./runtime.mjs";

export const pluginID = "taskbelay-zcode@taskbelay-zcode-local";

const stableVersion = value => typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

async function readManifest(p) {
  const manifest = JSON.parse(await readFile(join(p.packageRoot, "package.json"), "utf8"));
  if (manifest.name !== "taskbelay-zcode" || !stableVersion(manifest.version) ||
      !Array.isArray(manifest.files) || manifest.files.some(file => typeof file !== "string")) {
    throw new Error("Invalid ZCode Adapter package identity");
  }
  return manifest;
}

async function regularOwnedPath(path, directory) {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) {
      throw new Error(`ZCode registration must use regular owned ${directory ? "directories" : "files"}: ${path}`);
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}

async function readReceipt(p) {
  for (const directory of [p.productRoot, dirname(p.receiptPath)]) await regularOwnedPath(directory, true);
  await regularOwnedPath(p.receiptPath, false);
  let receipt;
  try { receipt = JSON.parse(await readFile(p.receiptPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  if (receipt.product?.name !== "taskbelay-zcode" || receipt.host?.surface !== "zcode-ui" ||
      !["prepared", "removal_required"].includes(receipt.phase) ||
      !isAbsolute(receipt.paths?.package_root ?? "") || resolve(receipt.paths.package_root) !== p.packageRoot ||
      !isAbsolute(receipt.paths?.receipt_path ?? "") || resolve(receipt.paths.receipt_path) !== p.receiptPath ||
      resolve(receipt.paths?.marketplace_path ?? "") !== p.marketplacePath) {
    throw new Error("ZCode registration belongs to another package or has an invalid identity");
  }
  return receipt;
}

async function inspectPackage(p, manifest, options) {
  const plugin = JSON.parse(await readFile(join(p.packageRoot, ".zcode-plugin", "plugin.json"), "utf8"));
  const marketplace = JSON.parse(await readFile(p.marketplacePath, "utf8"));
  const entries = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const entry = entries.find(value => value.name === "taskbelay-zcode");
  if (plugin.name !== manifest.name || plugin.version !== manifest.version ||
      marketplace.name !== "taskbelay-zcode-local" || entries.length !== 1 ||
      entry?.source !== "./" || entry?.version !== manifest.version) {
    throw new Error("ZCode package, plugin and marketplace identities must agree");
  }
  const digest = createHash("sha256");
  for (const file of [...new Set(["package.json", ...manifest.files])].sort()) {
    if (typeof file !== "string" || isAbsolute(file)) throw new Error("Invalid package file path");
    const target = resolve(p.packageRoot, file), offset = relative(p.packageRoot, target);
    if (!offset || offset === ".." || offset.startsWith("../") || offset.startsWith("..\\") || isAbsolute(offset)) {
      throw new Error("Package file must remain inside its package");
    }
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Package file is missing or not regular: ${file}`);
    digest.update(file).update("\0").update(await readFile(target)).update("\0");
  }
  const result = await (options.core ?? core)(["version"], options);
  const version = result.stdout.trim().match(/(?:^|\s)(\d+\.\d+\.\d+)(?:\s|$)/)?.[1];
  if (!stableVersion(version)) throw new Error("Core version unavailable");
  return { version, digest: digest.digest("hex") };
}

export function activationSteps(marketplacePath) {
  return [
    `Open a ZCode workspace, then Settings > Plugins > Create > Add marketplace and select ${marketplacePath}.`,
    `Install and enable ${pluginID} from Personal. For an updated local package, refresh this marketplace; if its version is unchanged, uninstall and reinstall the plugin so its cached files are replaced.`,
    "Start a new ZCode session. Check the TaskBelay Skill, plugin MCP server and Write/Edit Hook in ZCode before starting a Task. This CLI cannot observe their loaded state.",
  ];
}

export const removalSteps = () => [
  `In ZCode Settings > Plugins > Manage installed, uninstall ${pluginID}; then remove taskbelay-zcode-local from Marketplace sources.`,
  "Close affected ZCode sessions and start a new session to discard the previous plugin/Hook snapshot. The CLI cannot verify removal of ZCode's cached plugin.",
  "After the user confirms the plugin and marketplace were removed and affected sessions were closed, run taskbelay-zcode remove --confirm-host-removed --json; then repeat taskbelay uninstall --host zcode --yes (or use npm uninstall --global taskbelay-zcode for an Adapter-only installation).",
  "Task data, Git workspaces and unrelated ZCode settings are retained.",
];

function report(operation, p, manifest, receipt, { changed = false, inspected = null, issues = [] } = {}) {
  const removing = receipt?.phase === "removal_required";
  const prepared = receipt?.phase === "prepared" && inspected && receipt.package_digest === inspected.digest &&
    receipt.product.version === manifest.version && receipt.product.core_version === inspected.version &&
    receipt.host.os === process.platform && receipt.host.arch === process.arch &&
    receipt.paths.runtime_path === p.runtimePath && receipt.paths.data_dir === p.dataDirectory;
  return {
    operation, status: removing || prepared ? "action_required" : "partial", changed,
    package_version: manifest.version, core_version: inspected?.version ?? receipt?.product.core_version ?? null,
    receipt_path: p.receiptPath,
    registration: { receipt: Boolean(receipt), package: Boolean(inspected), host: "unverified", phase: receipt?.phase ?? null },
    issues,
    next_steps: removing ? removalSteps() : prepared ? activationSteps(p.marketplacePath) : ["Run taskbelay-zcode setup --json to prepare and verify the local plugin source.", ...issues],
  };
}

export async function status(options = {}) {
  const p = await paths(options.environment, options);
  const [manifest, receipt] = await Promise.all([readManifest(p), readReceipt(p)]);
  if (receipt?.phase === "removal_required") return report("status", p, manifest, receipt);
  let inspected = null;
  const issues = [];
  try { inspected = await inspectPackage(p, manifest, options); }
  catch (error) { issues.push(error.message); }
  return report("status", p, manifest, receipt, { inspected, issues });
}

async function saveReceipt(p, receipt) {
  for (const directory of [p.productRoot, dirname(p.receiptPath)]) {
    await regularOwnedPath(directory, true);
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  await regularOwnedPath(p.receiptPath, false);
  const temporary = `${p.receiptPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(receipt) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, p.receiptPath);
  } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}

function receiptFor(p, manifest, phase, inspected) {
  return {
    product: { name: manifest.name, version: manifest.version, core_version: inspected?.version ?? null },
    host: { surface: "zcode-ui", os: process.platform, arch: process.arch },
    paths: { package_root: p.packageRoot, runtime_path: p.runtimePath, data_dir: p.dataDirectory,
      receipt_path: p.receiptPath, marketplace_path: p.marketplacePath },
    phase, package_digest: inspected?.digest ?? null,
  };
}

export async function setup(options = {}) {
  const p = await paths(options.environment, options);
  const [manifest, current] = await Promise.all([readManifest(p), readReceipt(p)]);
  const inspected = await inspectPackage(p, manifest, options);
  const next = receiptFor(p, manifest, "prepared", inspected);
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  if (changed) await saveReceipt(p, next);
  return report("setup", p, manifest, next, { inspected, changed });
}

export async function remove(options = {}) {
  const p = await paths(options.environment, options);
  const [manifest, current] = await Promise.all([readManifest(p), readReceipt(p)]);
  if (options.hostRemoved === true) {
    if (current) await unlink(p.receiptPath);
    return {
      operation: "remove", status: "absent", changed: Boolean(current),
      package_version: manifest.version, core_version: current?.product.core_version ?? null,
      receipt_path: p.receiptPath,
      registration: { receipt: false, package: true, host: "user_confirmed_removed", phase: null },
      issues: [],
      next_steps: ["User-confirmed ZCode removal was recorded by clearing the owned receipt; no Host UI check was performed.",
        "Run taskbelay uninstall --host zcode --yes again, or npm uninstall --global taskbelay-zcode for an Adapter-only installation, to remove the remaining package. Task data is retained."],
    };
  }
  const next = current ? { ...current, phase: "removal_required" } : receiptFor(p, manifest, "removal_required", null);
  const changed = current?.phase !== "removal_required";
  if (changed) await saveReceipt(p, next);
  return report("remove", p, manifest, next, { changed });
}
