import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { listProfileReceipts, removeProfileReceipt, writeProfileReceipt } from "../ownership.mjs";

const execFile = promisify(execFileCallback);

export function createDeepSeekDriver({
  paths,
  environment = process.env,
  run = runChild,
  npmExecutable = "npm",
  dshExecutable = "dsh",
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async knownProfiles() {
      return (await listProfileReceipts(paths)).map((receipt) => receipt.profile);
    },

    async observe(profile) {
      const host = await optionalText(run, dshExecutable, ["--version"], { environment });
      if (!host.available) return Object.freeze({ host: "deepseek", profile, hostAvailable: false, hostVersion: null, state: "absent", packageVersion: null, receipt: null });
      const dump = await optionalText(run, dshExecutable, ["--profile", profile, "--dump-config"], { environment });
      const contribution = dump.available && /(^|\n)\s*-?\s*id:\s*dev-flow-deepseek\s*($|\n)/u.test(dump.stdout);
      const receipt = (await listProfileReceipts(paths)).find((entry) => entry.profile === profile) ?? null;
      return Object.freeze({
        host: "deepseek",
        profile,
        hostAvailable: true,
        hostVersion: firstVersion(host.stdout),
        state: contribution ? "ready" : receipt ? "partial" : "absent",
        packageVersion: receipt?.installed_version ?? null,
        receipt,
      });
    },

    async resolveTargetVersion(target) {
      const result = await run(npmExecutable, ["view", `dev-flow-deepseek@${target}`, "version", "--json"], { environment });
      const value = parseJSON(result.stdout, "npm DeepSeek version");
      const version = Array.isArray(value) ? value.at(-1) : value;
      return stableVersion(version, "DeepSeek target version");
    },

    async execute(operation, { profile, targetVersion, observed, adopt = false }) {
      if (!observed.hostAvailable) throw nextStepError("DeepSeek Harness is unavailable", "Install or update DSH, then rerun the same command.");
      if (operation === "uninstall") {
        if (observed.state === "absent") {
          await removeProfileReceipt(paths, profile);
          return { changed: false, completedSteps: [] };
        }
        const completedSteps = [];
        try {
          await run(dshExecutable, ["plugin", "--profile", profile, "remove", "dev-flow-deepseek"], { environment });
          completedSteps.push(`deepseek.${profile}.remove`);
          await assertContribution(run, dshExecutable, profile, environment, false);
          await removeProfileReceipt(paths, profile);
          completedSteps.push(`deepseek.${profile}.remove_receipt`);
          return { changed: true, completedSteps };
        } catch (error) {
          throw partialError(error, completedSteps, `repair DeepSeek Profile ${profile}, then resume uninstall`);
        }
      }

      if (operation !== "reinstall" && !adopt && observed.state === "ready" && observed.packageVersion === targetVersion) {
        return { changed: false, completedSteps: [] };
      }

      const temporaryRoot = await mkdtemp(join(tmpdir(), "create-dev-flow-deepseek-"));
      const completedSteps = [];
      try {
        const packed = await run(npmExecutable, ["pack", `dev-flow-deepseek@${targetVersion}`, "--json"], { environment, cwd: temporaryRoot });
        const report = Array.isArray(parseJSON(packed.stdout, "npm pack")) ? parseJSON(packed.stdout, "npm pack")[0] : parseJSON(packed.stdout, "npm pack");
        if (report?.name !== "dev-flow-deepseek" || report?.version !== targetVersion || typeof report?.filename !== "string" || basename(report.filename) !== report.filename) {
          throw new Error("DeepSeek artifact identity is invalid");
        }
        const artifact = await realpath(join(temporaryRoot, report.filename));
        completedSteps.push(`deepseek.${profile}.verify_artifact`);
        if (observed.state !== "absent") {
          await run(dshExecutable, ["plugin", "--profile", profile, "remove", "dev-flow-deepseek"], { environment });
          completedSteps.push(`deepseek.${profile}.remove`);
          await assertContribution(run, dshExecutable, profile, environment, false);
        }
        await run(dshExecutable, ["plugin", "--profile", profile, "add", artifact], { environment });
        completedSteps.push(`deepseek.${profile}.add`);
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
        return { changed: true, completedSteps, temporaryRoots: [temporaryRoot] };
      } catch (error) {
        throw partialError(error, completedSteps, `rerun repair for DeepSeek Profile ${profile}`);
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
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
    return await execFile(executable, arguments_, { cwd, env: environment, encoding: "utf8", maxBuffer: 1024 * 1024, timeout, windowsHide: true, shell: false });
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
  error.nextStep = nextStep;
  return error;
}

function nextStepError(message, nextStep) {
  const error = new Error(message);
  error.nextStep = nextStep;
  return error;
}
