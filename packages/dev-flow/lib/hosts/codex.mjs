import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export function createCodexDriver({
  environment = process.env,
  run = runChild,
  npmExecutable = "npm",
  codexExecutable = "codex",
  adapterExecutable = "dev-flow-codex",
  localPackage = null,
} = {}) {
  return Object.freeze({
    async observe() {
      const host = await optionalText(run, codexExecutable, ["--version"], { environment });
      const status = await optionalJSON(run, adapterExecutable, ["status", "--json"], { environment });
      return Object.freeze({
        host: "codex",
        profile: null,
        hostAvailable: host.available,
        hostVersion: host.available ? firstVersion(host.stdout) : null,
        state: status.available ? normalizeStatus(status.value.status) : "absent",
        packageInstalled: status.available,
        packageVersion: status.available ? status.value.package_version : null,
        coreVersion: status.available ? status.value.core_version : null,
        receipt: status.available ? status.value.registration.receipt : false,
      });
    },

    async resolveTargetVersion(target) {
      if (localPackage) return stableVersion(localPackage.version, "local Codex package version");
      const result = await run(npmExecutable, ["view", `dev-flow-codex@${target}`, "version", "--json"], { environment });
      const value = parseJSON(result.stdout, "npm Codex version");
      const version = Array.isArray(value) ? value.at(-1) : value;
      return stableVersion(version, "Codex target version");
    },

    async execute(operation, { targetVersion, observed, onProgress = () => {} }) {
      if (!observed.hostAvailable) throw nextStepError("Codex Host is unavailable", "Install or update Codex, then rerun the same command.");
      if (operation === "uninstall") {
        if (observed.state === "absent" && !observed.packageInstalled) return { changed: false, completedSteps: [] };
        const completedSteps = [];
        try {
          await run(adapterExecutable, ["remove", "--json"], { environment });
          completedSteps.push("codex.remove_registration");
          onProgress("codex.remove_registration");
          await run(npmExecutable, ["uninstall", "--global", "dev-flow-codex"], { environment });
          completedSteps.push("codex.uninstall_package");
          onProgress("codex.uninstall_package");
          return { changed: true, completedSteps };
        } catch (error) {
          throw partialError(error, completedSteps, "repair Codex lifecycle state, then resume uninstall");
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
        const packageSource = localPackage?.path ?? `dev-flow-codex@${targetVersion}`;
        await run(npmExecutable, ["install", "--global", packageSource], { environment });
        completedSteps.push("codex.install_package");
        onProgress("codex.install_package");
        await run(adapterExecutable, ["setup", "--json"], { environment });
        completedSteps.push("codex.setup_registration");
        onProgress("codex.setup_registration");
        const verified = await optionalJSON(run, adapterExecutable, ["status", "--json"], { environment });
        if (!verified.available || verified.value.status !== "ready" || verified.value.package_version !== targetVersion) {
          throw new Error("Codex status readback did not verify the target version");
        }
        completedSteps.push("codex.verify_ready");
        onProgress("codex.verify_ready");
        return { changed: true, completedSteps };
      } catch (error) {
        throw partialError(error, completedSteps, "rerun repair for Codex");
      }
    },
  });
}

export async function runChild(executable, arguments_, { environment = process.env, cwd = process.cwd(), timeout = 120_000 } = {}) {
  try {
    return await execFile(executable, arguments_, {
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
    wrapped.code = error?.code;
    wrapped.stderr = String(error?.stderr ?? "").slice(0, 2048);
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
  error.nextStep = nextStep;
  return error;
}

function nextStepError(message, nextStep) {
  const error = new Error(message);
  error.nextStep = nextStep;
  return error;
}
