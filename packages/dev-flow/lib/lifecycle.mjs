import { mkdir } from "node:fs/promises";

import { CLIError, confirmPlan, parseArguments, promptForRequest } from "./cli.mjs";
import { createCodexDriver } from "./hosts/codex.mjs";
import { createDeepSeekDriver } from "./hosts/deepseek.mjs";
import { clearRunRecords, createRun, recordRun } from "./journal.mjs";
import {
  inspectResource,
  moveTargetsToTrash,
  permanentlyRemoveTargets,
  resolveManagerPaths,
  writeOwnedJSON,
} from "./ownership.mjs";
import { createLifecyclePlan } from "./plan.mjs";
import { renderPlan, renderProgress, renderResult, resolveLanguage } from "./presentation.mjs";

export async function runMain(arguments_, dependencies = {}) {
  const input = dependencies.input ?? process.stdin;
  const output = dependencies.output ?? process.stdout;
  const errorOutput = dependencies.errorOutput ?? process.stderr;
  let request;
  try {
    const environment = dependencies.environment ?? process.env;
    const language = resolveLanguage(environment);
    request = parseArguments(arguments_, {
      isTTY: dependencies.isTTY ?? Boolean(input.isTTY && output.isTTY),
      noColor: dependencies.noColor ?? process.env.NO_COLOR !== undefined,
    });
    if (request.interactive) request = await (dependencies.promptForRequest ?? promptForRequest)({ input, output, language, environment });
    const onProgress = request.outputMode === "json" || !["install", "upgrade", "repair", "reinstall"].includes(request.operation)
      ? undefined
      : (event) => output.write(renderProgress(event, { language }));
    const result = await runLifecycle(request, { ...dependencies, input, output, environment, language, onProgress });
    if (request.outputMode !== "json" && result.plan) output.write(renderPlan(result.plan, { mode: request.outputMode, language }));
    output.write(renderResult(result.result, {
      mode: request.outputMode,
      language,
    }));
    return { code: result.code };
  } catch (error) {
    const json = request?.outputMode === "json" || arguments_.includes("--json");
    const result = failureResult(request?.operation ?? "status", error);
    if (json) output.write(`${JSON.stringify(result)}\n`);
    else errorOutput.write(`dev-flow: ${error.message}\n${result.next_step ? `${result.next_step}\n` : ""}`);
    return { code: error.exitCode ?? (error instanceof CLIError ? 2 : 1) };
  }
}

export async function runLifecycle(request, dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  const paths = await (dependencies.resolveManagerPaths ?? resolveManagerPaths)({
    homeDirectory: dependencies.homeDirectory,
    environment,
  });
  const codex = dependencies.codexDriver ?? createCodexDriver({
    environment,
    run: dependencies.runCodexChild,
    localPackage: dependencies.localPackages?.codex ?? null,
  });
  const deepseek = dependencies.deepseekDriver ?? createDeepSeekDriver({
    paths,
    environment,
    run: dependencies.runDeepSeekChild,
    localPackage: dependencies.localPackages?.deepseek ?? null,
  });
  const observed = await observeLifecycle(request, { paths, codex, deepseek });
  const targetVersions = await resolveTargetVersions(request, observed, { codex, deepseek });
  const plan = createLifecyclePlan(request, observed, {
    targetVersions,
    planId: dependencies.planId,
    token: dependencies.token,
    now: dependencies.now,
  });

  if (["status", "doctor"].includes(request.operation)) {
    return { code: 0, plan: null, result: resultFromObservation(request.operation, observed) };
  }

  const confirmed = await (dependencies.confirmPlan ?? confirmPlan)(plan, request, {
    input: dependencies.input ?? process.stdin,
    output: dependencies.output ?? process.stdout,
    language: dependencies.language ?? resolveLanguage(environment),
  });
  if (!confirmed) {
    return {
      code: 3,
      plan,
      result: confirmationResult(request, plan),
    };
  }

  if (plan.actions.length === 0) {
    return { code: 0, plan, result: resultFromObservation(request.operation, observed) };
  }

  let run = await (dependencies.createRun ?? createRun)(paths, plan, { now: dependencies.now, operationId: dependencies.operationId });
  const completedActions = [];
  let changed = false;
  let trashRoot = null;
  try {
    for (const action of plan.actions) {
      dependencies.onProgress?.({ type: "action_start", action });
      let effect;
      if (action.owner === "codex") {
        const current = await codex.observe();
        effect = await codex.execute(action.operation, {
          targetVersion: action.targetVersion,
          observed: current,
          onProgress: (stepId) => dependencies.onProgress?.({ type: "step_complete", action, stepId }),
        });
      } else if (action.owner === "deepseek") {
        const current = await deepseek.observe(action.profile);
        effect = await deepseek.execute(action.operation, {
          profile: action.profile,
          targetVersion: action.targetVersion,
          observed: current,
          adopt: request.adopt,
          onProgress: (stepId) => dependencies.onProgress?.({ type: "step_complete", action, stepId }),
        });
      } else if (action.operation === "cleanup") {
        effect = await executeCleanup(request, observed, paths, dependencies);
        trashRoot = effect.trashRoot ?? null;
      } else if (action.operation === "initialize") {
        effect = await initializeFreshState(paths);
      } else {
        throw new Error(`unsupported planned action ${action.actionId}`);
      }
      changed ||= effect.changed;
      completedActions.push(action.actionId, ...(effect.completedSteps ?? []));
      dependencies.onProgress?.({ type: "action_complete", action });
      run = await (dependencies.recordRun ?? recordRun)(paths, run, {
        completed_action_ids: [...completedActions],
        failed_action_id: null,
        temporary_roots: [...new Set([...run.temporary_roots, ...(effect.temporaryRoots ?? [])])],
        trash_root: trashRoot,
        next_step: "continue",
      }, { now: dependencies.now });
    }
  } catch (error) {
    completedActions.push(...(error.completedSteps ?? []));
    await (dependencies.recordRun ?? recordRun)(paths, run, {
      completed_action_ids: [...new Set(completedActions)],
      failed_action_id: plan.actions.find((action) => !run.completed_action_ids.includes(action.actionId))?.actionId ?? "unknown",
      trash_root: error.trashRoot ?? trashRoot,
      next_step: error.nextStep ?? "rerun the same lifecycle command to resume",
    }, { now: dependencies.now }).catch(() => {});
    error.exitCode ??= completedActions.length > 0 ? 5 : 1;
    error.completedSteps = completedActions;
    throw error;
  }

  const finalObserved = await observeLifecycle(request, { paths, codex, deepseek });
  const result = resultFromObservation(request.operation, finalObserved, {
    operationId: run.operation_id,
    changed,
    completedActions: [...new Set(completedActions)],
    restartRequirements: plan.restartRequirements,
    dataPolicy: request.operation === "factory-reset" ? request.permanent ? "permanent_reset" : "trash_reset" : "preserve",
    trashRoot,
  });
  await (dependencies.recordRun ?? recordRun)(paths, run, {
    completed_action_ids: [...new Set(completedActions)],
    failed_action_id: null,
    trash_root: trashRoot,
    next_step: "complete",
  }, { now: dependencies.now }).catch(() => {});
  if (request.operation === "factory-reset") {
    await (dependencies.clearRunRecords ?? clearRunRecords)(paths, {
      trashRoot,
      permanent: request.permanent,
    });
  }
  return { code: 0, plan, result };
}

export async function observeLifecycle(request, { paths, codex, deepseek }) {
  const knownDeepSeekProfiles = await deepseek.knownProfiles();
  const profiles = request.host === "codex" ? [] : request.allKnownProfiles
    ? [...new Set([...knownDeepSeekProfiles, ...request.profiles])]
    : request.profiles;
  const [codexState, deepseekStates, configuration, defaultData, explicitData] = await Promise.all([
    request.host === "deepseek" ? Promise.resolve(absentCodex()) : codex.observe(),
    Promise.all(profiles.map((profile) => deepseek.observe(profile))),
    inspectResource(paths.configurationPath, "configuration"),
    inspectResource(paths.defaultDataDirectory, "default-data"),
    paths.explicitDataDirectory ? inspectResource(paths.explicitDataDirectory, "explicit-data") : Promise.resolve(null),
  ]);
  return Object.freeze({
    codex: codexState,
    deepseek: deepseekStates,
    knownDeepSeekProfiles,
    resources: { configuration, defaultData, explicitData },
  });
}

async function resolveTargetVersions(request, observed, { codex, deepseek }) {
  const result = {};
  const needsVersion = ["install", "upgrade", "repair", "reinstall"].includes(request.operation) || request.operation === "factory-reset" && request.reinstallAfterReset;
  if (!needsVersion) return result;
  if (request.host === "codex" || request.host === "all") result["codex:default"] = await codex.resolveTargetVersion(request.targetVersion);
  if (request.host === "deepseek" || request.host === "all") {
    const version = await deepseek.resolveTargetVersion(request.targetVersion);
    for (const target of observed.deepseek) result[`deepseek:${target.profile}`] = version;
  }
  return result;
}

async function executeCleanup(request, observed, paths, dependencies) {
  const targets = [observed.resources.configuration, observed.resources.defaultData].filter((target) => target.exists);
  if (observed.resources.explicitData?.exists) {
    if (!request.confirmedExplicitData.includes(observed.resources.explicitData.path)) {
      const error = new Error("explicit Task data requires exact --confirm-explicit-data");
      error.exitCode = 4;
      throw error;
    }
    targets.push(observed.resources.explicitData);
  }
  if (request.permanent) {
    const removed = await (dependencies.permanentlyRemoveTargets ?? permanentlyRemoveTargets)(targets, { allowedPaths: targets.map((target) => target.path) });
    return { changed: removed.length > 0, completedSteps: removed.map((entry) => `manager.remove.${entry.label}`), trashRoot: null };
  }
  const moved = await (dependencies.moveTargetsToTrash ?? moveTargetsToTrash)(paths, targets, { now: dependencies.now, random: dependencies.random });
  return { changed: moved.moved.length > 0, completedSteps: moved.moved.map((entry) => `manager.trash.${entry.label}`), trashRoot: moved.trashRoot };
}

async function initializeFreshState(paths) {
  await mkdir(paths.defaultDataDirectory, { recursive: true, mode: 0o700 });
  await writeOwnedJSON(paths.configurationPath, {
    codex: { codebase_memory: false },
    deepseek: { codebase_memory: false },
  }, { root: paths.configurationDirectory });
  return { changed: true, completedSteps: ["manager.initialize_configuration", "manager.initialize_data"] };
}

function resultFromObservation(operation, observed, {
  operationId = null,
  changed = false,
  completedActions = [],
  restartRequirements = [],
  dataPolicy = "preserve",
  trashRoot = null,
} = {}) {
  const targets = [observed.codex, ...observed.deepseek]
    .filter((target) => target.host !== "codex" || target.hostAvailable || target.state !== "absent")
    .map((target) => ({ host: target.host, profile: target.profile, package_version: target.packageVersion, core_version: target.coreVersion ?? null, state: target.state }));
  const states = targets.map((target) => target.state);
  const status = states.some((state) => ["partial", "incompatible", "conflicted", "unknown"].includes(state)) ? "partial"
    : states.length > 0 && states.every((state) => state === "absent") ? "absent"
      : states.some((state) => state === "restart_required") ? "restart_required" : "ready";
  return {
    operation_id: operationId,
    operation,
    status,
    changed,
    targets,
    data: {
      policy: dataPolicy,
      configuration: observed.resources.configuration.exists ? "present" : "absent",
      default_data: observed.resources.defaultData.exists ? "present" : "absent",
      explicit_data: observed.resources.explicitData ? [observed.resources.explicitData.path] : [],
      trash_root: trashRoot,
    },
    completed_actions: completedActions,
    failed_action: null,
    restart_requirements: restartRequirements,
    confirmation: null,
    next_step: null,
  };
}

function confirmationResult(request, plan) {
  return {
    operation_id: null,
    operation: request.operation,
    status: "confirmation_required",
    changed: false,
    targets: plan.targets.map((target) => ({ host: target.host, profile: target.profile, package_version: target.packageVersion, core_version: null, state: target.state })),
    data: { policy: "preserve", configuration: "preserved", default_data: "preserved", explicit_data: [], trash_root: null },
    completed_actions: [],
    failed_action: null,
    restart_requirements: plan.restartRequirements,
    confirmation: {
      class: plan.confirmationClass,
      plan_id: plan.planId,
      token: plan.confirmationToken ?? plan.downgradeToken,
      permanent_token: plan.permanentToken,
      impacts: plan.impacts,
    },
    next_step: "rerun with the confirmation token from this plan",
  };
}

function failureResult(operation, error) {
  return {
    operation_id: null,
    operation,
    status: error.completedSteps?.length ? "partial" : "failed",
    changed: Boolean(error.completedSteps?.length),
    targets: [],
    data: { policy: "preserve", configuration: "unknown", default_data: "unknown", explicit_data: [], trash_root: error.trashRoot ?? null },
    completed_actions: error.completedSteps ?? [],
    failed_action: error.failedAction ?? null,
    restart_requirements: [],
    confirmation: null,
    next_step: error.nextStep ?? "correct the reported condition and rerun the same command",
  };
}

function absentCodex() {
  return Object.freeze({ host: "codex", profile: null, hostAvailable: false, hostVersion: null, state: "absent", packageInstalled: false, packageVersion: null, coreVersion: null, receipt: false });
}
