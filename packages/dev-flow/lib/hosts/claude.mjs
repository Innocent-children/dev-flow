import { adapterCoreRuntimePath, installedCoreRuntime, readRuntimeJSON } from "../core-runtime.mjs";
import { execPortableCommand } from "../command.mjs";
import { lstat, readFile, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
const stable = v => { if (typeof v !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v)) throw new Error("Invalid Claude Adapter version"); return v; };
const defaultRun = (exe, args, { environment = process.env, ...options } = {}) => execPortableCommand(exe, args, { ...options, env: environment, encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
export function createClaudeDriver({ environment = process.env, run = defaultRun, localPackage = null, paths = null } = {}) {
  const call = (exe, args) => run(exe, args, { environment });
  const readOrphan = async () => {
    if (!paths) return null;
    const receiptPath = join(paths.productRoot, "registrations", "claude.json");
    try {
      for (const target of [join(paths.productRoot, "registrations"), receiptPath]) if ((await lstat(target)).isSymbolicLink()) throw new Error("Claude registration may not use a symbolic link");
      const raw = await readFile(receiptPath, "utf8"), receipt = JSON.parse(raw);
      if (receipt.product?.name !== "dev-flow-claude" || !isAbsolute(receipt.paths?.package_root ?? "") ||
          resolve(receipt.paths?.receipt_path ?? "") !== resolve(receiptPath) ||
          resolve(receipt.paths?.config_root ?? "") !== resolve(environment.CLAUDE_CONFIG_DIR || join(paths.homeDirectory, ".claude"))) throw new Error("Claude orphan registration ownership is invalid");
      return { raw, receipt, receiptPath };
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  return {
    async runtimeCandidates() {
      const receipt = await readRuntimeJSON(join(paths.productRoot, "registrations", "claude.json"), "Claude receipt");
      if (receipt === null) return [];
      const product = exactObject(receipt.product, ["name", "version", "core_version"], "Claude receipt product");
      const host = exactObject(receipt.host, ["surface", "version", "os", "arch"], "Claude receipt host");
      const recorded = exactObject(receipt.paths, ["package_root", "runtime_path", "data_dir", "receipt_path", "config_root"], "Claude receipt paths");
      if (product.name !== "dev-flow-claude" || host.surface !== "claude-cli" || `${host.os}-${host.arch}` !== paths.runtimeKey) {
        throw new Error("Claude receipt identity is invalid");
      }
      stable(product.version);
      stable(product.core_version);
      if (resolve(recorded.runtime_path) !== resolve(adapterCoreRuntimePath(recorded.package_root, paths))) {
        throw new Error("Claude runtime differs from its package layout");
      }
      return [{ source: "claude", packageName: "dev-flow-claude", packageVersion: product.version,
        expectedCoreVersion: product.core_version, packageRoot: recorded.package_root, runtimePath: recorded.runtime_path }];
    },
    async maintenanceTargets({ observed, operation }) {
      const receipt = await readRuntimeJSON(join(paths.productRoot, "registrations", "claude.json"), "Claude receipt").catch(() => null);
      const recorded = receipt?.paths?.runtime_path;
      let installedRuntime = null;
      if (observed.packageInstalled) {
        const root = (await call("npm", ["root", "--global"])).stdout.trim();
        if (!root) throw new Error("npm did not return its global package directory");
        installedRuntime = await installedCoreRuntime(join(root, "dev-flow-claude"), paths,
          { host: "claude", profile: null, packageName: "dev-flow-claude" });
      }
      const registeredCorePaths = typeof recorded === "string" && recorded !== "" ? [recorded] : [];
      if (operation === "factory-reset" && (observed.packageInstalled || observed.receipt)) {
        const [marketResult, pluginResult] = await Promise.all([
          call("claude", ["plugin", "marketplace", "list", "--json"]),
          call("claude", ["plugin", "list", "--json"]),
        ]);
        const markets = JSON.parse(marketResult.stdout), plugins = JSON.parse(pluginResult.stdout);
        if (!Array.isArray(markets) || !Array.isArray(plugins)) throw new Error("Invalid Claude registration listing");
        const matchingMarkets = markets.filter(entry => entry.name === "dev-flow-claude-local");
        const expectedRoot = receipt?.paths?.package_root ?? installedRuntime?.packageRoot;
        if (matchingMarkets.length > 1 || matchingMarkets.some(entry => entry.source !== "directory" || !isAbsolute(entry.path ?? "") ||
            !isAbsolute(expectedRoot ?? "") || resolve(entry.path) !== resolve(expectedRoot))) throw new Error("Claude marketplace source ownership changed");
        const matchingPlugins = plugins.filter(entry => entry.id === "dev-flow-claude@dev-flow-claude-local" && entry.scope === "user");
        if (plugins.some(entry => entry.id?.endsWith("@dev-flow-claude-local") &&
            (entry.id !== "dev-flow-claude@dev-flow-claude-local" || entry.scope !== "user"))) throw new Error("Other plugin scopes still use the Claude marketplace");
        if (matchingPlugins.length > 1 || matchingPlugins.length && matchingMarkets.length !== 1) throw new Error("Cannot establish Claude cached plugin ownership");
        for (const plugin of matchingPlugins) {
          if (!isAbsolute(plugin.installPath ?? "")) throw new Error("Claude cached plugin path is unavailable");
          registeredCorePaths.push(adapterCoreRuntimePath(plugin.installPath, paths));
        }
      }
      return { registeredCorePaths: [...new Set(registeredCorePaths)], installedRuntime };
    },
    async observe() {
      const issues = []; let hostAvailable = false, hostVersion = null, value = null, packageVersion = null;
      try { hostVersion = (await call("claude", ["--version"])).stdout.trim(); hostAvailable = true; }
      catch (error) { issues.push({ code: "host_missing", message: error.message, command: "claude --version" }); }
      try { value = JSON.parse((await call("dev-flow-claude", ["status", "--json"])).stdout); packageVersion = stable(value.package_version); }
      catch (error) {
        try {
          let result;
          try { result = await call("npm", ["list", "--global", "--depth=0", "--json", "dev-flow-claude"]); }
          catch (failure) { if (!failure.stdout) throw failure; result = failure; }
          const report = JSON.parse(result.stdout);
          const installed = report.dependencies?.["dev-flow-claude"];
          if (installed) packageVersion = stable(installed.version);
        } catch (failure) { issues.push({ code: "package_check_failed", message: failure.message, command: "npm list --global dev-flow-claude" }); }
        if (packageVersion) issues.push({ code: "adapter_check_failed", message: error.message, command: "dev-flow repair --host claude --yes" });
      }
      let orphanedRegistration = false;
      if (!packageVersion) {
        try { orphanedRegistration = Boolean(await readOrphan()); }
        catch (error) { issues.push({ code: "registration_check_failed", message: error.message, command: "dev-flow doctor --host claude" }); }
      }
      if (orphanedRegistration) issues.push({ code: "orphaned_registration", message: "Claude registration remains after package removal", command: "dev-flow uninstall --host claude --yes" });
      if (!packageVersion && !orphanedRegistration && !issues.length) {
        issues.push({ code: "adapter_missing", message: "Dev Flow Claude Adapter is not installed.", command: "dev-flow install --host claude --yes" });
      }
      const state = value?.status === "ready" && hostAvailable ? "ready" : packageVersion || orphanedRegistration || issues.some(v => ["package_check_failed", "registration_check_failed"].includes(v.code)) ? "partial" : "absent";
      return { host: "claude", profile: null, hostAvailable, hostVersion, state, packageInstalled: Boolean(packageVersion), packageVersion, coreVersion: value?.core_version ?? null, receipt: orphanedRegistration || value?.registration?.receipt === true, orphanedRegistration, issues };
    },
    async resolveTargetVersion(target) {
      if (localPackage) return stable(localPackage.version);
      const v = JSON.parse((await call("npm", ["view", "dev-flow-claude@" + target, "version", "--json"])).stdout);
      return stable(Array.isArray(v) ? v.at(-1) : v);
    },
    async execute(operation, { targetVersion, observed, onProgress = () => {}, onStepStart = () => {} }) {
      const completedSteps = [];
      const step = async (name, exe, args) => { onStepStart(name); await call(exe, args); completedSteps.push(name); onProgress(name); };
      try {
        if (operation === "uninstall") {
          if (!observed.packageInstalled && !observed.receipt) return { changed: false, completedSteps };
          if (observed.orphanedRegistration) {
            const orphan = await readOrphan();
            if (!orphan) throw new Error("Claude orphan registration changed");
            const markets = JSON.parse((await call("claude", ["plugin", "marketplace", "list", "--json"])).stdout);
            const plugins = JSON.parse((await call("claude", ["plugin", "list", "--json"])).stdout);
            if (!Array.isArray(markets) || !Array.isArray(plugins)) throw new Error("Invalid Claude registration listing");
            const market = markets.find(v => v.name === "dev-flow-claude-local");
            if (market && (market.source !== "directory" || resolve(market.path) !== resolve(orphan.receipt.paths.package_root))) throw new Error("Claude marketplace source ownership changed");
            if (!market && plugins.some(v => v.id === "dev-flow-claude@dev-flow-claude-local")) throw new Error("Cannot establish orphan plugin source ownership");
            if (plugins.some(v => v.id.endsWith("@dev-flow-claude-local") && (v.id !== "dev-flow-claude@dev-flow-claude-local" || v.scope !== "user"))) throw new Error("Other plugin scopes still use the Claude marketplace");
            if (plugins.some(v => v.id === "dev-flow-claude@dev-flow-claude-local" && v.scope === "user")) await step("claude.remove_plugin", "claude", ["plugin", "uninstall", "dev-flow-claude@dev-flow-claude-local", "--scope", "user", "--json"]);
            if (market) await step("claude.remove_marketplace", "claude", ["plugin", "marketplace", "remove", "dev-flow-claude-local"]);
            if (await readFile(orphan.receiptPath, "utf8") !== orphan.raw) throw new Error("Claude receipt changed during removal");
            await unlink(orphan.receiptPath);
            return { changed: true, completedSteps };
          }
          await step("claude.remove_registration", "dev-flow-claude", ["remove", "--json"]);
          await step("claude.uninstall_package", "npm", ["uninstall", "--global", "dev-flow-claude"]);
        } else {
          if (!observed.hostAvailable) throw new Error("Claude Code is unavailable");
          if (!localPackage && observed.state === "ready" && observed.packageVersion === targetVersion && operation !== "reinstall") return { changed: false, completedSteps };
          if (observed.receipt && observed.packageInstalled) await step("claude.remove_registration", "dev-flow-claude", ["remove", "--json"]);
          await step("claude.install_package", "npm", ["install", "--global", localPackage?.path ?? "dev-flow-claude@" + stable(targetVersion)]);
          await step("claude.setup_registration", "dev-flow-claude", ["setup", "--json"]);
          const result = JSON.parse((await call("dev-flow-claude", ["status", "--json"])).stdout);
          if (result.status !== "ready" || result.package_version !== targetVersion) throw new Error("Claude installation readback failed");
        }
        return { changed: true, completedSteps, nextSteps: operation === "uninstall" ? [] : ["Reload Claude plugins or start a new Claude Code session."] };
      } catch (error) { error.completedSteps = completedSteps; error.nextStep = operation === "uninstall" ? "dev-flow uninstall --host claude --yes" : "dev-flow repair --host claude --yes"; throw error; }
    }
  };
}

function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} fields are invalid`);
  }
  return value;
}
