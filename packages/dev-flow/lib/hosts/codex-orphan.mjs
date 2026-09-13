import { lstat, readFile, realpath, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { registrationPath } from "../platform.mjs";

// The manager owns cleanup when the Adapter package no longer exists. Installed
// packages continue to own their shutdown and registration lifecycle.
export async function inspectOrphanRegistration(paths) {
  if (!paths) return null;
  const receiptPath = join(paths.productRoot, "registrations", "codex.json");
  for (const target of [paths.productRoot, dirname(receiptPath), receiptPath]) {
    const info = await optionalStat(target);
    if (!info) return null;
    if (info.isSymbolicLink()) throw new Error("Codex registration path must not be a symbolic link");
  }
  const bytes = await readFile(receiptPath, "utf8");
  const receipt = JSON.parse(bytes);
  const root = receipt.paths?.package_root;
  const registration = receipt.registration;
  const absolute = value => typeof value === "string" && isAbsolute(value) && resolve(value) === value;
  if (receipt.product?.name !== "dev-flow-codex" || !/^\d+\.\d+\.\d+$/.test(receipt.product?.version) ||
      !absolute(root) || basename(root) !== "dev-flow-codex" ||
      registration?.marketplace_name !== "dev-flow-local" || registration.marketplace_root !== root ||
      registration.plugin_name !== "dev-flow-codex" || registration.plugin_selector !== "dev-flow-codex@dev-flow-local" ||
      registration.plugin_root !== join(root, "plugin") ||
      receipt.paths.runtime_path !== join(root, "runtime", paths.runtimeDirectory, paths.runtimeExecutable) ||
      !absolute(receipt.paths.data_dir) || !absolute(receipt.paths.receipt_path) ||
      await realpath(receipt.paths.receipt_path) !== await realpath(receiptPath)) {
    throw new Error("orphan Codex registration receipt ownership conflict");
  }
  if (await optionalStat(root)) throw new Error("Codex package still exists; use its removal command");
  return { receiptPath, bytes, receipt };
}

export async function removeOrphanRegistration(paths, { run, codexExecutable, environment }) {
  const snapshot = await inspectOrphanRegistration(paths);
  if (!snapshot) return { changed: false };
  const { receipt, receiptPath, bytes } = snapshot;
  // Inspect both recorded and selected data locations without deleting Task data.
  for (const data of new Set([receipt.paths.data_dir, paths.explicitDataDirectory ?? paths.defaultDataDirectory])) {
    if (await optionalStat(join(data, "webui-runtime.json"))) {
      throw new Error("Core runtime is missing while a WebUI runtime record remains; restore the runtime before removal");
    }
  }
  let changed = false;
  const invoke = async args => {
    const result = await run(codexExecutable, args, { environment });
    if (args.includes("remove")) changed = true;
    return JSON.parse(result.stdout);
  };
  const registration = receipt.registration;
  const normalize = value => registrationPath(value, paths.platform, paths.arch);
  const readState = async () => {
    const markets = await invoke(["plugin", "marketplace", "list", "--json"]);
    const plugins = await invoke(["plugin", "list", "--json"]);
    if (!Array.isArray(markets.marketplaces) || !Array.isArray(plugins.installed) ||
        !Array.isArray(plugins.available) || plugins.available.length) throw new Error("invalid Codex registration readback");
    const matchingMarkets = markets.marketplaces.filter(entry => entry.name === registration.marketplace_name ||
      normalize(entry.root) === registration.marketplace_root);
    const matchingPlugins = plugins.installed.filter(entry => entry.pluginId === registration.plugin_selector ||
      entry.name === registration.plugin_name || normalize(entry.source?.path) === registration.plugin_root);
    if (matchingMarkets.length > 1 || matchingPlugins.length > 1) throw new Error("ambiguous Codex registration ownership");
    const market = matchingMarkets[0];
    const plugin = matchingPlugins[0];
    if (market && (market.name !== registration.marketplace_name || normalize(market.root) !== registration.marketplace_root ||
        market.marketplaceSource && (market.marketplaceSource.sourceType !== "local" ||
        normalize(market.marketplaceSource.source) !== registration.marketplace_root))) throw new Error("Codex marketplace ownership conflict");
    if (plugin && (plugin.pluginId !== registration.plugin_selector || plugin.name !== registration.plugin_name ||
        plugin.marketplaceName !== registration.marketplace_name || plugin.installed !== true ||
        plugin.source?.source !== "local" || normalize(plugin.source.path) !== registration.plugin_root ||
        plugin.marketplaceSource?.sourceType !== "local" ||
        normalize(plugin.marketplaceSource.source) !== registration.marketplace_root)) throw new Error("Codex plugin ownership conflict");
    return { market, plugin };
  };
  try {
    let state = await readState();
    if (state.plugin) {
      const result = await invoke(["plugin", "remove", registration.plugin_selector, "--json"]);
      if (result.pluginId !== registration.plugin_selector || result.name !== registration.plugin_name ||
          result.marketplaceName !== registration.marketplace_name) throw new Error("Codex plugin removal result conflicts with receipt");
      state = await readState();
      if (state.plugin) throw new Error("Codex plugin remains after removal readback");
    }
    if (state.market) {
      const result = await invoke(["plugin", "marketplace", "remove", registration.marketplace_name, "--json"]);
      if (result.marketplaceName !== registration.marketplace_name || result.installedRoot !== null) throw new Error("Codex marketplace removal result conflicts with receipt");
      state = await readState();
      if (state.market || state.plugin) throw new Error("Codex registration remains after removal readback");
    }
    const current = await inspectOrphanRegistration(paths);
    if (!current || current.bytes !== bytes) throw new Error("Codex registration receipt changed during removal");
    await unlink(receiptPath);
    return { changed: true };
  } catch (error) {
    error.changed = changed;
    throw error;
  }
}

async function optionalStat(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
