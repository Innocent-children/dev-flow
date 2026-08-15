#!/usr/bin/env node

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

const statePath = requiredIsolatedPath("FAKE_CODEX_STATE");
const tracePath = requiredIsolatedPath("FAKE_CODEX_TRACE");
const argv = process.argv.slice(2);
const failure = process.env.FAKE_CODEX_FAIL ?? "";

await recordTrace(argv);

if (argv.length === 1 && argv[0] === "--version") {
  process.stdout.write(`codex-cli ${process.env.FAKE_CODEX_VERSION ?? "0.147.0"}\n`);
  process.exit(0);
}

if (argv[0] !== "plugin") {
  fail(`unsupported fake Codex command: ${argv.join(" ")}`);
}

const state = await readState();
const command = argv.slice(1);
const commandKey = command.filter((argument) => argument !== "--json" && argument !== "--available").join(":");
if (failure && (failure === commandKey || failure === command.slice(0, 2).join(":"))) {
  fail(`injected fake Codex failure: ${failure}`, 73);
}

let result;
if (command[0] === "marketplace") {
  result = await handleMarketplace(state, command.slice(1));
} else {
  result = await handlePlugin(state, command);
}

if (result.mutated) {
  await writeState(state);
}

if (command.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result.output)}\n`);
} else if (result.text) {
  process.stdout.write(`${result.text}\n`);
}

function requiredIsolatedPath(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) {
    fail(`${name} must name an absolute test-only path`);
  }
  return resolve(value);
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!Array.isArray(parsed.marketplaces) || !Array.isArray(parsed.plugins)) {
      fail("fake Codex state must contain marketplaces and plugins arrays");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { marketplaces: [], plugins: [] };
    }
    throw error;
  }
}

async function writeState(state) {
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, statePath);
}

async function recordTrace(arguments_) {
  await mkdir(dirname(tracePath), { recursive: true, mode: 0o700 });
  const entry = {
    argv: arguments_,
    cwd: process.cwd(),
    at: new Date().toISOString(),
  };
  await appendFile(tracePath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

async function handleMarketplace(state, command) {
  const [operation, operand] = command;
  if (operation === "list") {
    return { mutated: false, output: state.marketplaces, text: renderNames(state.marketplaces) };
  }
  if (operation === "add") {
    if (!operand) fail("marketplace add requires a source");
    const root = resolve(operand);
    const catalog = JSON.parse(await readFile(resolve(root, ".agents/plugins/marketplace.json"), "utf8"));
    const entry = { name: catalog.name, source: operand, root };
    if (!entry.name) fail("marketplace catalog must contain a name");
    const existing = state.marketplaces.find((item) => item.name === entry.name);
    if (existing && existing.root !== entry.root) fail(`marketplace conflict: ${entry.name}`, 74);
    if (!existing) state.marketplaces.push(entry);
    return { mutated: !existing, output: entry, text: `Added marketplace ${entry.name}` };
  }
  if (operation === "remove") {
    if (!operand) fail("marketplace remove requires a name");
    const before = state.marketplaces.length;
    state.marketplaces = state.marketplaces.filter((item) => item.name !== operand);
    return {
      mutated: state.marketplaces.length !== before,
      output: { name: operand, removed: state.marketplaces.length !== before },
      text: `Removed marketplace ${operand}`,
    };
  }
  fail(`unsupported fake marketplace command: ${command.join(" ")}`);
}

async function handlePlugin(state, command) {
  const [operation, operand] = command;
  if (operation === "list") {
    const marketplaceIndex = command.indexOf("--marketplace");
    const marketplace = marketplaceIndex >= 0 ? command[marketplaceIndex + 1] : undefined;
    const plugins = marketplace
      ? state.plugins.filter((item) => item.marketplace_name === marketplace)
      : state.plugins;
    return { mutated: false, output: plugins, text: renderNames(plugins) };
  }
  if (operation === "add") {
    const selector = requireSelector(operand);
    const marketplace = state.marketplaces.find((item) => item.name === selector.marketplace);
    if (!marketplace) fail(`unknown marketplace: ${selector.marketplace}`, 75);
    const catalog = JSON.parse(
      await readFile(resolve(marketplace.root, ".agents/plugins/marketplace.json"), "utf8"),
    );
    const catalogPlugin = catalog.plugins?.find((item) => item.name === selector.name);
    if (!catalogPlugin) fail(`unknown plugin: ${operand}`, 75);
    const pluginRoot = resolve(marketplace.root, catalogPlugin.source.path);
    const manifest = JSON.parse(
      await readFile(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
    );
    const entry = {
      name: selector.name,
      marketplace_name: selector.marketplace,
      selector: operand,
      root: pluginRoot,
      source: catalogPlugin.source,
      version: manifest.version,
      installed: true,
      enabled: true,
    };
    const existing = state.plugins.find((item) => item.selector === operand);
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
      fail(`plugin conflict: ${operand}`, 74);
    }
    if (!existing) state.plugins.push(entry);
    return { mutated: !existing, output: entry, text: `Installed plugin ${operand}` };
  }
  if (operation === "remove") {
    const selector = requireSelector(operand);
    const normalized = `${selector.name}@${selector.marketplace}`;
    const before = state.plugins.length;
    state.plugins = state.plugins.filter((item) => item.selector !== normalized);
    return {
      mutated: state.plugins.length !== before,
      output: { selector: normalized, removed: state.plugins.length !== before },
      text: `Removed plugin ${normalized}`,
    };
  }
  fail(`unsupported fake plugin command: ${command.join(" ")}`);
}

function requireSelector(value) {
  const [name, marketplace, extra] = (value ?? "").split("@");
  if (!name || !marketplace || extra !== undefined) {
    fail("plugin selector must be PLUGIN@MARKETPLACE");
  }
  return { name, marketplace };
}

function renderNames(entries) {
  return entries.map((entry) => entry.selector ?? entry.name).join("\n");
}

function fail(message, code = 64) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
