import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { execPortableCommand } from "../command.mjs";
import { inspectDeepSeekRuntime } from "../runtime.mjs";
import { listProfileReceipts, removeProfileReceipt, writeProfileReceipt } from "../ownership.mjs";

export function createDeepSeekDriver({
  paths,
  environment = process.env,
  run = runChild,
  npmExecutable = "npm",
  dshExecutable = "dsh",
  now = () => new Date(),
  localPackage = null,
  inspectRuntime = inspectDeepSeekRuntime,
} = {}) {
  return Object.freeze({
    async knownProfiles() {
      return (await listProfileReceipts(paths)).map((receipt) => receipt.profile);
    },

    async observe(profile) {
      const receipt = (await listProfileReceipts(paths)).find(entry => entry.profile === profile) ?? null;
      const issues = [];
      let host = { available: false };
      let contribution = false;
      let coreVersion = null;
      try {
        host = await optionalText(run, dshExecutable, ["--version"], { environment, timeout: 15_000 });
        if (host.available) {
          const dump = await run(dshExecutable, ["--profile", profile, "--dump-config"], { environment, timeout: 15_000 });
          contribution = /(^|\n)\s*-?\s*id:\s*dev-flow-deepseek\s*($|\n)/u.test(dump.stdout);
        }
      } catch (error) { issues.push({ code: "profile_check_failed", message: error.message, detail: error.stderr ?? "", command: `dsh --profile ${profile} --dump-config` }); }
      if (!host.available) issues.push({ code: "host_missing", message: "DeepSeek Harness is not installed or is not on PATH.", command: "dsh --version" });
      if (receipt && contribution) {
        try { coreVersion = (await inspectRuntime(paths, profile, receipt.installed_version, environment)).version; }
        catch (error) { issues.push({ code: "core_check_failed", message: error.message, command: `dev-flow repair --host deepseek --profile ${profile} --yes` }); }
      }
      if (contribution && !receipt) issues.push({ code: "unmanaged_profile", message: "This Profile has an Adapter without a lifecycle receipt. Adopt it explicitly.", command: `dev-flow repair --host deepseek --profile ${profile} --adopt --yes` });
      if (receipt && !contribution && host.available) issues.push({ code: "registration_incomplete", message: "DeepSeek Adapter contribution is missing.", command: `dev-flow repair --host deepseek --profile ${profile} --yes` });
      if (!receipt && !contribution && host.available && !issues.length) issues.push({ code: "adapter_missing", message: "Dev Flow DeepSeek Adapter is not installed.", command: `dev-flow install --host deepseek --profile ${profile} --yes` });
      return Object.freeze({ host: "deepseek", profile, hostAvailable: host.available,
        hostVersion: host.available ? firstVersion(host.stdout) : null,
        state: receipt || contribution ? issues.length ? "partial" : "ready" : issues.some(issue => issue.code === "profile_check_failed") ? "unknown" : "absent",
        packageVersion: receipt?.installed_version ?? null, coreVersion, receipt, contribution, issues });
    },

    async resolveTargetVersion(target) {
      if (localPackage) return stableVersion(localPackage.version, "local DeepSeek package version");
      const result = await run(npmExecutable, ["view", `dev-flow-deepseek@${target}`, "version", "--json"], { environment });
      const value = parseJSON(result.stdout, "npm DeepSeek version");
      const version = Array.isArray(value) ? value.at(-1) : value;
      return stableVersion(version, "DeepSeek target version");
    },

    async execute(operation, { profile, targetVersion, observed, adopt = false, onProgress = () => {}, onStepStart = () => {} }) {
      if (operation === "uninstall" && observed.state === "absent" && !observed.receipt) return { changed: false, completedSteps: [] };
      if (!observed.hostAvailable) throw nextStepError("DeepSeek Harness is unavailable", "dsh --version");
      if (operation === "uninstall") {
        if (observed.state === "absent" || observed.contribution === false && !observed.issues?.some(issue => issue.code === "profile_check_failed")) {
          await removeProfileReceipt(paths, profile);
          return { changed: Boolean(observed.receipt), completedSteps: observed.receipt ? [`deepseek.${profile}.remove_receipt`] : [] };
        }
        const completedSteps = [];
        try {
          onStepStart(`deepseek.${profile}.remove`);
          await run(dshExecutable, ["plugin", "--profile", profile, "remove", "dev-flow-deepseek"], { environment });
          completedSteps.push(`deepseek.${profile}.remove`);
          onProgress(`deepseek.${profile}.remove`);
          await assertContribution(run, dshExecutable, profile, environment, false);
          await removeProfileReceipt(paths, profile);
          completedSteps.push(`deepseek.${profile}.remove_receipt`);
          onProgress(`deepseek.${profile}.remove_receipt`);
          return { changed: true, completedSteps };
        } catch (error) {
          throw partialError(error, completedSteps, `dev-flow repair --host deepseek --profile ${profile} --yes`);
        }
      }

      if (!localPackage && operation !== "reinstall" && !adopt && observed.state === "ready" && observed.packageVersion === targetVersion) {
        return { changed: false, completedSteps: [] };
      }

      if (observed.contribution && !observed.receipt && !adopt) throw nextStepError(
        "DeepSeek Profile requires explicit adoption", `dev-flow repair --host deepseek --profile ${profile} --adopt --yes`);
      const temporaryRoot = localPackage ? null : await mkdtemp(join(tmpdir(), "create-dev-flow-deepseek-"));
      const completedSteps = [];
      try {
        onStepStart(`deepseek.${profile}.verify_artifact`);
        let artifact;
        if (localPackage) {
          artifact = await realpath(localPackage.path);
        } else {
          const packed = await run(npmExecutable, ["pack", `dev-flow-deepseek@${targetVersion}`, "--json"], { environment, cwd: temporaryRoot });
          const report = Array.isArray(parseJSON(packed.stdout, "npm pack")) ? parseJSON(packed.stdout, "npm pack")[0] : parseJSON(packed.stdout, "npm pack");
          if (report?.name !== "dev-flow-deepseek" || report?.version !== targetVersion || typeof report?.filename !== "string" || basename(report.filename) !== report.filename) {
            throw new Error("DeepSeek artifact identity is invalid");
          }
          artifact = await realpath(join(temporaryRoot, report.filename));
        }
        completedSteps.push(`deepseek.${profile}.verify_artifact`);
        onProgress(`deepseek.${profile}.verify_artifact`);
        if (observed.state !== "absent") {
          onStepStart(`deepseek.${profile}.remove`);
          await run(dshExecutable, ["plugin", "--profile", profile, "remove", "dev-flow-deepseek"], { environment });
          completedSteps.push(`deepseek.${profile}.remove`);
          onProgress(`deepseek.${profile}.remove`);
          await assertContribution(run, dshExecutable, profile, environment, false);
        }
        onStepStart(`deepseek.${profile}.add`);
        await run(dshExecutable, ["plugin", "--profile", profile, "add", artifact], { environment });
        completedSteps.push(`deepseek.${profile}.add`);
        onProgress(`deepseek.${profile}.add`);
        await assertContribution(run, dshExecutable, profile, environment, true);
        const timestamp = now().toISOString();
        await writeProfileReceipt(paths, {
          profile,
          package_name: "dev-flow-deepseek",
          installed_version: targetVersion,
          origin: adopt ? "adopted_by_reinstall" : "installed",
          dsh_version: observed.hostVersion,
          created_at: observed.receipt?.created_at ?? timestamp,
          updated_at: timestamp,
        });
        completedSteps.push(`deepseek.${profile}.write_receipt`);
        onProgress(`deepseek.${profile}.write_receipt`);
        await inspectRuntime(paths, profile, targetVersion, environment);
        completedSteps.push(`deepseek.${profile}.verify_ready`);
        onProgress(`deepseek.${profile}.verify_ready`);
        return { changed: true, completedSteps, nextSteps: [`Restart DeepSeek Profile ${profile}`], temporaryRoots: temporaryRoot ? [temporaryRoot] : [] };
      } catch (error) {
        throw partialError(error, completedSteps, `dev-flow repair --host deepseek --profile ${profile} --version ${targetVersion} --yes`);
      } finally {
        if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
      }
    },
  });
}

async function assertContribution(run, executable, profile, environment, expected) {
  const result = await run(executable, ["--profile", profile, "--dump-config"], { environment });
  const present = /(^|\n)\s*-?\s*id:\s*dev-flow-deepseek\s*($|\n)/u.test(result.stdout);
  if (present !== expected) throw new Error(`DeepSeek Profile ${profile} readback did not verify ${expected ? "presence" : "absence"}`);
}

async function runChild(executable, arguments_, { environment = process.env, cwd = process.cwd(), timeout = 120_000 } = {}) {
  try {
    return await execPortableCommand(executable, arguments_, { cwd, env: environment, encoding: "utf8", maxBuffer: 1024 * 1024, timeout, windowsHide: true, shell: false });
  } catch (error) {
    const wrapped = new Error(`${executable} ${arguments_.join(" ")} failed`, { cause: error });
    wrapped.code = error?.killed ? "COMMAND_TIMEOUT" : error?.code;
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

function parseJSON(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

function stableVersion(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function firstVersion(text) {
  return String(text).match(/\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/u)?.[0] ?? String(text).trim();
}

function partialError(error, completedSteps, nextStep) {
  error.completedSteps = [...completedSteps];
  error.changed = completedSteps.some(step => !step.endsWith("verify_artifact"));
  error.nextStep = nextStep;
  return error;
}

function nextStepError(message, nextStep) {
  const error = new Error(message);
  error.nextStep = nextStep;
  return error;
}
