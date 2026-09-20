import { join, resolve } from "node:path";
import { adapterCoreRuntimePath, installedCoreRuntime, readRuntimeJSON } from "../core-runtime.mjs";
import { execPortableCommand } from "../command.mjs";
import { inspectOrphanRegistration, removeOrphanRegistration } from "./codex-orphan.mjs";

export const CODEX_ACTIVATION_STEP = "Open Codex /hooks, review and trust the Dev Flow hook, then start a new conversation.";

export function createCodexDriver({
  environment = process.env,
  run = runChild,
  npmExecutable = "npm",
  codexExecutable = "codex",
  adapterExecutable = "dev-flow-codex",
  localPackage = null,
  paths = null,
} = {}) {
  return Object.freeze({
    async runtimeCandidates() {
      const receipt = await readRuntimeJSON(join(paths.productRoot, "registrations", "codex.json"), "Codex receipt");
      if (receipt === null) return [];
      const product = exactObject(receipt.product, ["name", "version", "core_version", "codex_compatibility"], "Codex receipt product");
      const host = exactObject(receipt.host, ["surface", "version", "os", "arch"], "Codex receipt host");
      const recorded = exactObject(receipt.paths, ["package_root", "runtime_path", "data_dir", "receipt_path"], "Codex receipt paths");
      if (product.name !== "dev-flow-codex") throw new Error("Codex receipt product identity is invalid");
      stableVersion(product.version, "Codex receipt package version");
      stableVersion(product.core_version, "Codex receipt Core version");
      if (host.surface !== "codex-cli" || `${host.os}-${host.arch}` !== paths.runtimeKey) {
        throw new Error("Codex receipt host platform differs from this runtime");
      }
      if (resolve(recorded.runtime_path) !== resolve(adapterCoreRuntimePath(recorded.package_root, paths))) {
        throw new Error("Codex receipt runtime path differs from the supported package layout");
      }
      return [{ source: "codex", packageName: "dev-flow-codex", packageVersion: product.version,
        expectedCoreVersion: product.core_version, packageRoot: recorded.package_root, runtimePath: recorded.runtime_path }];
    },

    async maintenanceTargets({ observed }) {
      const receipt = await readRuntimeJSON(join(paths.productRoot, "registrations", "codex.json"), "Codex receipt").catch(() => null);
      const recorded = receipt?.paths?.runtime_path;
      let installedRuntime = null;
      if (observed.packageInstalled) {
        const result = await run(npmExecutable, ["root", "--global"], { environment, timeout: 10_000 });
        const root = result.stdout.trim();
        if (!root) throw new Error("npm did not return its global package directory");
        installedRuntime = await installedCoreRuntime(join(root, "dev-flow-codex"), paths,
          { host: "codex", profile: null, packageName: "dev-flow-codex" });
      }
      return { registeredCorePaths: typeof recorded === "string" && recorded !== "" ? [recorded] : [], installedRuntime };
    },

    async observe() {
      const issues = [];
      let host = { available: false };
      try { host = await optionalText(run, codexExecutable, ["--version"], { environment, timeout: 15_000 }); }
      catch (error) { issues.push(issue("host_check_failed", error, "dev-flow doctor --host codex")); }
      if (!host.available && issues.length === 0) issues.push({ code: "host_missing", message: "Codex Host is not installed or is not on PATH.", command: "codex --version" });
      let status = { available: false };
      let metadata = null;
      try {
        status = await optionalJSON(run, adapterExecutable, ["status", "--json"], { environment, timeout: 15_000 });
        if (status.available) {
          normalizeStatus(status.value.status);
          stableVersion(status.value.package_version, "installed Codex version");
        }
      } catch (error) {
        issues.push(issue("adapter_check_failed", error, "dev-flow repair --host codex --yes"));
      }
      // npm metadata remains readable when the Adapter's Core self-check fails.
      if (!status.available || issues.some(entry => entry.code === "adapter_check_failed")) {
        try {
          let listed;
          try {
            listed = await run(npmExecutable, ["list", "--global", "--depth=0", "--json", "dev-flow-codex"], { environment, timeout: 15_000 });
          } catch (error) {
            // npm reports an empty filtered global list with exit code 1.
            if (error.code !== 1 || !error.stdout) throw error;
            const report = parseJSON(error.stdout, "npm installed packages");
            if (!report || Array.isArray(report) || report.errors?.length || report.dependencies?.["dev-flow-codex"]) throw error;
            listed = { stdout: error.stdout };
          }
          metadata = parseJSON(listed.stdout, "npm installed packages").dependencies?.["dev-flow-codex"] ?? null;
          if (metadata) stableVersion(metadata.version, "installed Codex version");
        } catch (error) {
          issues.push(issue("package_check_failed", error, "npm list --global --depth=0 dev-flow-codex"));
        }
      }
      let orphan = null;
      if (!status.available && !metadata) {
        try { orphan = await inspectOrphanRegistration(paths); }
        catch (error) { issues.push(issue("registration_check_failed", error, "dev-flow doctor --host codex")); }
      }
      const installed = status.available || Boolean(metadata);
      const healthy = status.available && !issues.some(entry => entry.code === "adapter_check_failed");
      const state = issues.some(entry => entry.code !== "host_missing") ? "partial"
        : !host.available && installed ? "partial" : healthy ? normalizeStatus(status.value.status) : installed || orphan ? "partial" : "absent";
      if (orphan) issues.push({ code: "orphaned_registration", message: "Codex registration remains after its Adapter package was removed.", command: "dev-flow uninstall --host codex --yes" });
      if (!installed && !issues.length) issues.push({ code: "adapter_missing", message: "Dev Flow Codex Adapter is not installed.", command: "dev-flow install --host codex --yes" });
      if (installed && state !== "ready" && !issues.length) issues.push({ code: "registration_incomplete", message: "Codex Adapter registration is incomplete.", command: "dev-flow repair --host codex --yes" });
      return Object.freeze({
        host: "codex", profile: null, hostAvailable: host.available,
        hostVersion: host.available ? firstVersion(host.stdout) : null,
        state, packageInstalled: installed,
        packageVersion: metadata?.version ?? (healthy ? status.value.package_version : null),
        coreVersion: healthy ? status.value.core_version : null,
        receipt: orphan !== null || (healthy ? status.value.registration?.receipt ?? false : false),
        orphanedRegistration: orphan !== null,
        issues,
      });
    },

    async resolveTargetVersion(target) {
      if (localPackage) return stableVersion(localPackage.version, "local Codex package version");
      const result = await run(npmExecutable, ["view", `dev-flow-codex@${target}`, "version", "--json"], { environment });
      const value = parseJSON(result.stdout, "npm Codex version");
      const version = Array.isArray(value) ? value.at(-1) : value;
      return stableVersion(version, "Codex target version");
    },

    async execute(operation, { targetVersion, observed, onProgress = () => {}, onStepStart = () => {} }) {
      if (!observed.hostAvailable && operation !== "uninstall") throw nextStepError("Codex Host is unavailable", "codex --version");
      if (operation === "uninstall") {
        if (observed.state === "absent" && !observed.packageInstalled) return { changed: false, completedSteps: [] };
        const completedSteps = [];
        try {
          onStepStart("codex.remove_registration");
          if (observed.orphanedRegistration) {
            await removeOrphanRegistration(paths, { run, codexExecutable, environment });
          } else {
            await run(adapterExecutable, ["remove", "--json"], { environment });
          }
          completedSteps.push("codex.remove_registration");
          onProgress("codex.remove_registration");
          if (!observed.orphanedRegistration) {
            onStepStart("codex.uninstall_package");
            await run(npmExecutable, ["uninstall", "--global", "dev-flow-codex"], { environment });
            completedSteps.push("codex.uninstall_package");
            onProgress("codex.uninstall_package");
          }
          return { changed: true, completedSteps };
        } catch (error) {
          throw partialError(error, completedSteps, observed.orphanedRegistration ? "dev-flow uninstall --host codex --yes" : "dev-flow repair --host codex --yes");
        }
      }

      if (!localPackage && operation === "install" && observed.state === "ready" && observed.packageVersion === targetVersion) {
        return { changed: false, completedSteps: [] };
      }
      if (!localPackage && ["upgrade", "repair"].includes(operation) && observed.state === "ready" && observed.packageVersion === targetVersion) {
        return { changed: false, completedSteps: [] };
      }

      const completedSteps = [];
      try {
        // Local builds can change Core or resources without publishing a new
        // npm version. Remove only the receipt-owned registration before
        // replacing that package, then let setup create the current receipt.
        const changesVersion = observed.packageVersion && observed.packageVersion !== targetVersion;
        const downgrade = changesVersion && compareVersions(targetVersion, observed.packageVersion) < 0;
        const removedBeforeInstall = observed.receipt && (localPackage || downgrade || changesVersion && observed.state !== "ready");
        if (removedBeforeInstall) {
          onStepStart("codex.remove_registration");
          await run(adapterExecutable, ["remove", "--json"], { environment });
          completedSteps.push("codex.remove_registration");
          onProgress("codex.remove_registration");
        }
        const packageSource = localPackage?.path ?? `dev-flow-codex@${targetVersion}`;
        onStepStart("codex.install_package");
        await run(npmExecutable, ["install", "--global", packageSource], { environment });
        completedSteps.push("codex.install_package");
        onProgress("codex.install_package");
        // Restore package files first, then rebuild the same-version owned registration.
        if (!removedBeforeInstall && observed.packageVersion === targetVersion &&
            (observed.state !== "ready" || operation === "reinstall")) {
          onStepStart("codex.remove_registration");
          await run(adapterExecutable, ["remove", "--json"], { environment });
          completedSteps.push("codex.remove_registration");
          onProgress("codex.remove_registration");
        }
        onStepStart("codex.setup_registration");
        const setup = await run(adapterExecutable, ["setup", "--json"], { environment });
        completedSteps.push("codex.setup_registration");
        onProgress("codex.setup_registration");
        const verified = await optionalJSON(run, adapterExecutable, ["status", "--json"], { environment });
        if (!verified.available || verified.value.status !== "ready" || verified.value.package_version !== targetVersion) {
          throw new Error("Codex status readback did not verify the target version");
        }
        completedSteps.push("codex.verify_ready");
        onProgress("codex.verify_ready");
        const nextSteps = [CODEX_ACTIVATION_STEP];
        const setupResult = parseJSON(setup.stdout, "Codex setup");
        if (setupResult.next_step) nextSteps.push(typeof setupResult.next_step === "string" ? setupResult.next_step : setupResult.next_step.command ?? setupResult.next_step.summary ?? "");
        return { changed: true, completedSteps, nextSteps: nextSteps.filter(Boolean) };
      } catch (error) {
        throw partialError(error, completedSteps, `dev-flow repair --host codex --version ${targetVersion} --yes`);
      }
    },
  });
}

export async function runChild(executable, arguments_, { environment = process.env, cwd = process.cwd(), timeout = 120_000 } = {}) {
  try {
    return await execPortableCommand(executable, arguments_, {
      cwd,
      env: environment,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout,
      windowsHide: true,
      shell: false,
    });
  } catch (error) {
    const wrapped = new Error(`${executable} ${arguments_.join(" ")} failed`, { cause: error });
    wrapped.code = error?.killed ? "COMMAND_TIMEOUT" : error?.code;
    wrapped.stdout = String(error?.stdout ?? "");
    wrapped.stderr = String(error?.stderr || error?.message || "").slice(0, 2048);
    throw wrapped;
  }
}

async function optionalText(run, executable, arguments_, options) {
  try {
    return { available: true, ...(await run(executable, arguments_, options)) };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.cause?.code === "ENOENT") return { available: false, stdout: "", stderr: "" };
    throw error;
  }
}

async function optionalJSON(run, executable, arguments_, options) {
  const text = await optionalText(run, executable, arguments_, options);
  return text.available ? { available: true, value: parseJSON(text.stdout, executable) } : { available: false, value: null };
}

function parseJSON(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

function firstVersion(text) {
  return String(text).match(/\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/u)?.[0] ?? String(text).trim();
}

function stableVersion(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function normalizeStatus(value) {
  if (!["ready", "partial", "absent"].includes(value)) throw new Error("Codex status is invalid");
  return value;
}

function partialError(error, completedSteps, nextStep) {
  error.completedSteps = [...completedSteps];
  error.changed = error.changed === true || completedSteps.some(step => !step.endsWith("verify_ready"));
  error.nextStep = nextStep;
  return error;
}

function nextStepError(message, nextStep) {
  const error = new Error(message);
  error.nextStep = nextStep;
  return error;
}

function issue(code, error, command) {
  return { code, message: error.message, detail: String(error.stderr ?? error.cause?.stderr ?? "").trim(), command };
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} fields are invalid`);
  }
  return value;
}
