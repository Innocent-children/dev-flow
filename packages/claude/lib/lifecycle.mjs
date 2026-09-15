import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execPortableCommand } from "./command.mjs";
import { paths, core } from "./runtime.mjs";
export const pluginID = "dev-flow-claude@dev-flow-claude-local";
export const minimumClaudeVersion = "2.1.270";
const market = "dev-flow-claude-local";
export async function runClaude(args, options = {}) {
  return (await (options.exec ?? execPortableCommand)(options.claudeExecutable ?? "claude", args, { env: options.environment ?? process.env, windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 30000 })).stdout;
}
async function mutate(args, options) {
  const raw = await runClaude([...args, "--json"], options);
  const result = JSON.parse(raw.trim().split(/\r?\n/).at(-1));
  if (result.outcome !== "ok") throw new Error(result.message || "Claude plugin operation failed");
}
async function observe(options) {
  const p = await paths(options.environment);
  const plugins = JSON.parse(await runClaude(["plugin", "list", "--json"], options));
  const markets = JSON.parse(await runClaude(["plugin", "marketplace", "list", "--json"], options));
  if (!Array.isArray(plugins) || !Array.isArray(markets)) throw new Error("Invalid Claude listing");
  const matching = markets.filter(v => v.name === market);
  if (matching.length > 1 || matching.some(v => v.source !== "directory" || typeof v.path !== "string" || resolve(v.path) !== p.packageRoot)) throw new Error("Claude marketplace name belongs to another source");
  let receipt = null;
  try { receipt = JSON.parse(await readFile(p.receiptPath, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  if (receipt && (receipt.product?.name !== "dev-flow-claude" || resolve(receipt.paths?.package_root || "") !== p.packageRoot || resolve(receipt.paths?.config_root || "") !== p.configRoot)) throw new Error("Claude registration belongs to another package/configuration directory");
  return { p, plugins, marketplace: matching[0], installed: plugins.find(v => v.id === pluginID && v.scope === "user"), receipt };
}
async function identity(options) {
  const p = await paths(options.environment), manifest = JSON.parse(await readFile(join(p.packageRoot, "package.json"), "utf8"));
  const version = (await (options.core ?? core)(["version"], options)).stdout.match(/\d+\.\d+\.\d+/)?.[0];
  if (!version) throw new Error("Core version unavailable");
  return { manifest, version };
}
export async function status(options = {}) {
  const { p, installed, marketplace, receipt } = await observe(options), { manifest, version } = await identity(options);
  let closed = Boolean(installed && installed.version === manifest.version && installed.enabled === true && !installed.errors?.length && typeof installed.installPath === "string");
  if (closed) {
    try { for (const file of manifest.files) { if (!(await readFile(join(installed.installPath, file))).equals(await readFile(join(p.packageRoot, file)))) { closed = false; break; } } }
    catch { closed = false; }
  }
  const ready = receipt && marketplace && closed && receipt.product.version === manifest.version && receipt.product.core_version === version && resolve(receipt.paths.runtime_path) === p.runtimePath && resolve(receipt.paths.data_dir) === p.dataDirectory;
  return { operation: "status", status: ready ? "ready" : "partial", changed: false, package_version: manifest.version, core_version: version, receipt_path: p.receiptPath, registration: { receipt: Boolean(receipt), marketplace: Boolean(marketplace), plugin: Boolean(installed), cache: closed } };
}
export async function setup(options = {}) {
  const { p, installed, marketplace, receipt } = await observe(options), { manifest, version } = await identity(options);
  const hostVersion = (await runClaude(["--version"], options)).trim();
  const actual = hostVersion.match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number), minimum = minimumClaudeVersion.split(".").map(Number);
  if (!actual || actual.reduce((c,n,i) => c || Math.sign(n-minimum[i]), 0) < 0) throw new Error("Claude Code >= " + minimumClaudeVersion + " required");
  if (receipt) { const current = await status(options); if (current.status === "ready") return { ...current, operation: "setup" }; }
  if (!marketplace) await runClaude(["plugin", "marketplace", "add", p.packageRoot], options);
  if (installed) await mutate(["plugin", "uninstall", pluginID, "--scope", "user"], options);
  await mutate(["plugin", "install", pluginID, "--scope", "user"], options);
  const next = { product: { name: "dev-flow-claude", version: manifest.version, core_version: version }, host: { surface: "claude-cli", version: hostVersion, os: process.platform, arch: process.arch }, paths: { package_root: p.packageRoot, runtime_path: p.runtimePath, data_dir: p.dataDirectory, receipt_path: p.receiptPath, config_root: p.configRoot } };
  await mkdir(dirname(p.receiptPath), { recursive: true, mode: 0o700 });
  const temp = p.receiptPath + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(next) + "\n", { mode: 0o600, flag: "wx" }); await rename(temp, p.receiptPath);
  const verified = await status(options); if (verified.status !== "ready") throw new Error("Claude cached package/registration did not verify");
  return { ...verified, operation: "setup", changed: true, next_step: "Reload Claude plugins or start a new session; review plugin and workspace permissions." };
}
export async function remove(options = {}) {
  const { p, installed, marketplace, receipt, plugins } = await observe(options);
  if (installed && !marketplace) throw new Error("Cannot establish plugin source ownership");
  if (marketplace && plugins.some(v => v.id.endsWith("@" + market) && !(v.id === pluginID && v.scope === "user"))) throw new Error("Other plugin scopes still use this marketplace");
  if (installed) await mutate(["plugin", "uninstall", pluginID, "--scope", "user"], options);
  if (marketplace) await runClaude(["plugin", "marketplace", "remove", market], options);
  if (receipt) await unlink(p.receiptPath);
  return { operation: "remove", status: "absent", changed: Boolean(receipt || installed || marketplace), receipt_path: p.receiptPath, next_step: "Task data, workspaces and unrelated Claude configuration are retained." };
}
