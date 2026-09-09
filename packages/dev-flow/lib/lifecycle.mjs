import { mkdir } from "node:fs/promises";

import { diagnoseInstallation } from "./diagnostics.mjs";
import { CLIError, confirmPlan, parseArguments, promptForRequest, renderHelp } from "./cli.mjs";
import { createCodexDriver, CODEX_ACTIVATION_STEP } from "./hosts/codex.mjs";
import { createDeepSeekDriver } from "./hosts/deepseek.mjs";
import { clearRunRecords, createRun, recordRun } from "./journal.mjs";
import {
  inspectResource,
  moveTargetsToTrash,
  permanentlyRemoveTargets,
  resolveManagerPaths,
  writeOwnedJSON,
} from "./ownership.mjs";
import { supportsDesktopPet, loadPetInstaller, loadPetPlatform, loadMaintenancePlatform } from "./platform.mjs";

import { runPet, stopPetForCore } from "./pet.mjs";
import { createLifecyclePlan } from "./plan.mjs";
import { renderPlan, renderProgress, renderResult, resolveLanguage } from "./presentation.mjs";
import { createTerminalSession } from "./terminal.mjs";
import { formatCommand } from "./command.mjs";
import { listAdapterCoreRuntimes, runDevFlow } from "./runtime.mjs";
import { installedPackageRoot, readLocalPackages } from "./local-packages.mjs";

export async function runMain(arguments_, dependencies = {}) {
  const input = dependencies.input ?? process.stdin;
  const output = dependencies.output ?? process.stdout;
  const errorOutput = dependencies.errorOutput ?? process.stderr;
  let request;
  let session;
  const environment = dependencies.environment ?? process.env;
  const language = resolveLanguage(environment);
  const isTTY = dependencies.isTTY ?? Boolean(input.isTTY && output.isTTY);
  const interactive = arguments_.length === 0 && isTTY;
  try {
    if (!arguments_.length && !isTTY) { output.write(renderHelp(null, language)); return { code: 0 }; }
    request = parseArguments(arguments_, { isTTY, noColor: Object.hasOwn(environment, "NO_COLOR") });
    if (request.help) { output.write(renderHelp(request.help, language)); return { code: 0 }; }
    if (interactive) session = createTerminalSession(input, output);
    do {
      try {
        if (interactive) {
          output.write(language === "zh-CN" ? "正在检查安装…\n" : "Checking installation…\n");
          let observation;
          try {
            observation = (await runLifecycle(parseArguments(["status", "--host", "all", "--all-known-profiles"], { isTTY: false }), dependencies)).result;
          } catch (error) { observation = failureResult("status", error); }
          request = await (dependencies.promptForRequest ?? promptForRequest)({ input, output, language, environment,
            platform: dependencies.platform, arch: dependencies.arch, observation, session });
        }
        if (request.cancelled) return { code: 0 };
        if (request.pet || request.webui) {
          const options = { ...dependencies, stdout: output, stderr: errorOutput, environment, language };
          const result = request.pet
            ? await (dependencies.runPet ?? runPet)(["pet", request.pet], options)
            : await (dependencies.runDevFlow ?? runDevFlow)(["webui", request.webui], options);
          if (!interactive) return { code: result.code };
          continue;
        }
        const onProgress = request.outputMode === "json" ? undefined : event => output.write(renderProgress(event, { language }));
        const result = await runLifecycle(request, { ...dependencies, input, output, environment, language, session, onProgress });
        output.write(renderResult(result.result, { mode: request.outputMode, language }));
        if (!interactive) return { code: result.code };
      } catch (error) {
        const result = failureResult(request?.operation ?? "status", error);
        const mode = request?.outputMode === "json" || arguments_.includes("--json") ? "json" : "plain";
        (mode === "json" ? output : errorOutput).write(renderResult(result, { mode, language }));
        if (!interactive) return { code: error.exitCode ?? 1 };
      }
    } while (interactive);
  } catch (error) {
    const mode = arguments_.includes("--json") ? "json" : "plain";
    (mode === "json" ? output : errorOutput).write(renderResult(failureResult(arguments_[0] ?? "status", error), { mode, language }));
    return { code: error.exitCode ?? 1 };
  } finally { session?.close(); }
}

export async function runLifecycle(request, dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  const packageRoot = dependencies.packageRoot ?? installedPackageRoot;
  const usesArtifacts = ["install", "upgrade", "repair", "reinstall"].includes(request.operation) || request.reinstallAfterReset;
  const packagedLocalPackages = usesArtifacts ? await readLocalPackages(packageRoot) : null;
  const localPackages = dependencies.localPackages ?? packagedLocalPackages;
  if (localPackages && request.targetVersion && request.targetVersion !== "latest" && ["install", "upgrade", "repair", "reinstall"].includes(request.operation)) {
    const products = request.host === "all" ? ["codex", "deepseek"] : [request.host];
    if (products.some(product => localPackages[product].version !== request.targetVersion)) {
      throw new Error("the selected version is not contained in this local development package");
    }
  }
  let paths = await (dependencies.resolveManagerPaths ?? resolveManagerPaths)({
    homeDirectory: dependencies.homeDirectory,
    environment,
    platform: dependencies.platform,
    arch: dependencies.arch,
  });
  const codex = dependencies.codexDriver ?? createCodexDriver({
    environment,
    run: dependencies.runCodexChild,
    localPackage: localPackages?.codex ?? null,
  });
  let deepseek = dependencies.deepseekDriver ?? createDeepSeekDriver({
    paths,
    environment,
    run: dependencies.runDeepSeekChild,
    localPackage: localPackages?.deepseek ?? null,
  });
  dependencies.onProgress?.({ type: "phase", message: (dependencies.language ?? resolveLanguage(environment)) === "zh-CN" ? "检查 Host、Adapter 与本地资源" : "Checking Hosts, Adapters and local resources" });
  const observed = await observeLifecycle(request, { paths, codex, deepseek });
  if (["install", "upgrade", "repair", "reinstall"].includes(request.operation)) {
    const missing = [observed.codex, ...observed.deepseek].filter(target => target?.hostAvailable === false);
    if (missing.length) {
      const error = new Error(`Required Host unavailable: ${missing.map(target => target.host).join(", ")}`);
      error.nextStep = missing[0].host === "codex" ? "codex --version" : "dsh --version";
      throw error;
    }
    dependencies.onProgress?.({ type: "phase", message: (dependencies.language ?? resolveLanguage(environment)) === "zh-CN" ? "确认目标版本" : "Resolving target versions" });
  }
  const targetVersions = await resolveTargetVersions(request, observed, { codex, deepseek, localPackages });
  const petPlatform = usesArtifacts && supportsDesktopPet(paths.platform, paths.arch)
    ? await loadPetPlatform(paths.platform, paths.arch) : null;
  const installDesktopPet = petPlatform !== null && await petPlatform.isBundledPetApplicationAvailable(petPlatform.bundledPetExecutable(packageRoot));
  const plan = createLifecyclePlan(request, observed, {
    targetVersions,
    planId: dependencies.planId,
    token: dependencies.token,
    now: dependencies.now,
    platformKey: paths.runtimeKey,
    recoverableCleanupDescription: paths.recoverableCleanupDescription,
    replaceLocalPackages: localPackages !== null && localPackages !== undefined,
    installDesktopPet,
  });

  if (["status", "doctor"].includes(request.operation)) {
    const result = resultFromObservation(request.operation, observed);
    if (request.operation === "doctor") {
      result.checks = await diagnoseInstallation(observed, { host: request.host });
      if (result.checks.some(check => check.status === "failed") && result.status === "ready") result.status = "partial";
    }
    return { code: request.operation === "doctor" && result.status !== "ready" ? 1 : 0, plan: null, result };
  }

  if (request.outputMode !== "json") (dependencies.output ?? process.stdout).write(renderPlan(plan, {
    mode: request.outputMode, language: dependencies.language ?? resolveLanguage(environment),
  }));
  const confirmed = await (dependencies.confirmPlan ?? confirmPlan)(plan, request, {
    input: dependencies.input ?? process.stdin,
    output: dependencies.output ?? process.stdout,
    language: dependencies.language ?? resolveLanguage(environment),
    session: dependencies.session,
  });
  if (!confirmed) {
    return {
      code: 3,
      plan,
      result: confirmationResult(request, plan, paths.platform),
    };
  }

  if (plan.actions.length === 0) {
    return { code: 0, plan, result: resultFromObservation(request.operation, observed) };
  }

  // All reset inputs are checked before removing any Adapter.
  if (request.operation === "factory-reset" && observed.resources.explicitData?.exists &&
      !request.confirmedExplicitData.includes(observed.resources.explicitData.path)) {
    const path = observed.resources.explicitData.path;
    if (request.fromMenu && dependencies.session) {
      const answer = await dependencies.session.question(`${dependencies.language === "zh-CN" ? "输入完整路径确认清理" : "Type the full path to confirm cleanup"}: ${path}\n> `);
      if (answer !== path) return { code: 3, plan, result: confirmationResult(request, plan, paths.platform) };
      request = { ...request, confirmedExplicitData: [...request.confirmedExplicitData, path] };
    } else {
      const error = new Error(`explicit Task data requires exact --confirm-explicit-data ${path}`);
      error.exitCode = 4;
      error.nextStep = confirmationResult(request, plan, paths.platform).next_step;
      throw error;
    }
  }

  if (["install", "upgrade", "repair", "reinstall"].includes(request.operation)) {
    const maintenance = await loadMaintenancePlatform(paths.platform, paths.arch);
    if (await maintenance.prepareInstallation(paths)) {
      paths = await (dependencies.resolveManagerPaths ?? resolveManagerPaths)({
        homeDirectory: dependencies.homeDirectory, environment,
        platform: dependencies.platform, arch: dependencies.arch,
      });
      deepseek = dependencies.deepseekDriver ?? createDeepSeekDriver({
        paths, environment, run: dependencies.runDeepSeekChild,
        localPackage: localPackages?.deepseek ?? null,
      });
    }
  }
  dependencies.onProgress?.({ type: "phase", message: (dependencies.language ?? resolveLanguage(environment)) === "zh-CN" ? "准备维护，停止受影响的桌面进程" : "Preparing maintenance and stopping affected desktop processes" });
  await stopDesktopPetForMaintainedCores(request, plan, { paths, environment, dependencies, replaceDesktop: installDesktopPet });

  let run = await (dependencies.createRun ?? createRun)(paths, plan, { now: dependencies.now, operationId: dependencies.operationId });
  const completedActions = [];
  let changed = false;
  let trashRoot = null;
  let currentAction = null;
  const nextSteps = [];
  try {
    for (const action of plan.actions) {
      currentAction = action;
      dependencies.onProgress?.({ type: "action_start", action });
      let effect;
      if (action.owner === "codex") {
        const current = await codex.observe();
        effect = await codex.execute(action.operation, {
          targetVersion: action.targetVersion,
          observed: current,
          onProgress: (stepId) => dependencies.onProgress?.({ type: "step_complete", action, stepId }),
          onStepStart: (stepId) => dependencies.onProgress?.({ type: "step_start", action, stepId }),
        });
      } else if (action.owner === "deepseek") {
        const current = await deepseek.observe(action.profile);
        effect = await deepseek.execute(action.operation, {
          profile: action.profile,
          targetVersion: action.targetVersion,
          observed: current,
          adopt: request.adopt,
          onProgress: (stepId) => dependencies.onProgress?.({ type: "step_complete", action, stepId }),
          onStepStart: (stepId) => dependencies.onProgress?.({ type: "step_start", action, stepId }),
        });
      } else if (action.operation === "install_pet") {
        const installer = dependencies.petInstaller ?? await loadPetInstaller(paths.platform, paths.arch);
        const installation = await installer.ensurePetInstalled({
          petDirectory: paths.petDirectory, sourcePackageRoots: [packageRoot],
          enforcePrivateModes: paths.enforcePrivateModes, replaceExisting: true,
        });
        if (!installation.installed) throw new Error("the package did not install its desktop application");
        effect = { changed: installation.newlyInstalled === true };
      } else if (action.operation === "cleanup") {
        effect = await executeCleanup(request, observed, paths, dependencies);
        trashRoot = effect.trashRoot ?? null;
      } else if (action.operation === "initialize") {
        effect = await initializeFreshState(paths);
      } else {
        throw new Error(`unsupported planned action ${action.actionId}`);
      }
      changed ||= effect.changed;
      if (effect.nextSteps) nextSteps.push(...effect.nextSteps);
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
      failed_action_id: currentAction?.actionId ?? "unknown",
      trash_root: error.trashRoot ?? trashRoot,
      next_step: error.nextStep ?? retryCommand(request, currentAction, paths.platform),
    }, { now: dependencies.now }).catch(() => {});
    error.exitCode ??= completedActions.length > 0 ? 5 : 1;
    error.changed = changed || (error.changed ?? Boolean(error.completedSteps?.some(step => !step.endsWith("verify_artifact"))));
    error.trashRoot ??= trashRoot;
    error.completedSteps = completedActions;
    error.operationId = run.operation_id;
    error.failedAction = currentAction?.actionId ?? null;
    error.dataPolicy = request.operation === "factory-reset" ? request.permanent ? "permanent_reset" : "trash_reset" : "preserve";
    error.nextStep ??= retryCommand(request, currentAction, paths.platform);
    throw error;
  }

  let finalObserved;
  try { finalObserved = await observeLifecycle(request, { paths, codex, deepseek }); }
  catch (error) {
    error.completedSteps = completedActions;
    error.operationId = run.operation_id;
    error.failedAction = "verify_installation";
    error.exitCode = 5;
    error.changed = changed;
    error.trashRoot = trashRoot;
    error.dataPolicy = request.operation === "factory-reset" ? request.permanent ? "permanent_reset" : "trash_reset" : "preserve";
    await (dependencies.recordRun ?? recordRun)(paths, run, { failed_action_id: "verify_installation", next_step: "dev-flow doctor --host all" }, { now: dependencies.now }).catch(() => {});
    error.nextStep = "dev-flow doctor --host all";
    throw error;
  }
  const result = resultFromObservation(request.operation, finalObserved, {
    operationId: run.operation_id,
    changed,
    completedActions: [...new Set(completedActions)],
    restartRequirements: plan.restartRequirements,
    dataPolicy: request.operation === "factory-reset" ? request.permanent ? "permanent_reset" : "trash_reset" : "preserve",
    trashRoot,
  });
  result.next_steps = [...new Set([...result.next_steps, ...nextSteps, ...plan.restartRequirements])];
  const verified = request.operation === "factory-reset" && !request.reinstallAfterReset || request.operation === "uninstall"
    ? result.status === "absent" : result.status === "ready" || result.status === "restart_required";
  if (!verified) { result.failed_action = "verify_installation"; result.next_step = "dev-flow doctor --host all"; }
  await (dependencies.recordRun ?? recordRun)(paths, run, {
    completed_action_ids: [...new Set(completedActions)],
    failed_action_id: verified ? null : "verify_installation",
    trash_root: trashRoot,
    next_step: verified ? "complete" : "dev-flow doctor --host all",
  }, { now: dependencies.now }).catch(() => {});
  if (request.operation === "factory-reset") {
    await (dependencies.clearRunRecords ?? clearRunRecords)(paths, {
      trashRoot,
      permanent: request.permanent,
    });
  }
  return { code: verified ? 0 : 5, plan, result };
}

export async function observeLifecycle(request, { paths, codex, deepseek }) {
  const knownDeepSeekProfiles = request.host === "codex" ? [] : await deepseek.knownProfiles();
  let profiles = request.host === "codex" ? [] : request.allKnownProfiles
    ? [...new Set([...knownDeepSeekProfiles, ...request.profiles])]
    : request.profiles;
  if (request.host !== "codex" && profiles.length === 0 && ["install", "upgrade", "repair", "reinstall", "status", "doctor"].includes(request.operation)) profiles = ["web"];
  const [codexState, deepseekStates, configuration, defaultData, pet, explicitData] = await Promise.all([
    request.host === "deepseek" ? Promise.resolve(null) : codex.observe(),
    Promise.all(profiles.map((profile) => deepseek.observe(profile))),
    inspectResource(paths.configurationPath, "configuration"),
    inspectResource(paths.defaultDataDirectory, "default-data"),
    inspectResource(paths.petDirectory, "pet"),
    paths.explicitDataDirectory ? inspectResource(paths.explicitDataDirectory, "explicit-data") : Promise.resolve(null),
  ]);
  return Object.freeze({
    codex: codexState,
    deepseek: deepseekStates,
    knownDeepSeekProfiles,
    resources: { configuration, defaultData, pet, explicitData },
  });
}

async function resolveTargetVersions(request, observed, { codex, deepseek, localPackages }) {
  const result = {};
  if (!["install", "upgrade", "repair", "reinstall"].includes(request.operation) && !request.reinstallAfterReset) return result;
  const targets = [observed.codex, ...observed.deepseek].filter(Boolean);
  for (const target of targets) {
    const driver = target.host === "codex" ? codex : deepseek;
    const requested = request.targetVersion ?? (request.operation === "upgrade" || request.reinstallAfterReset ? "latest" : target.packageVersion ?? "latest");
    // A known installed version needs no registry access to produce an unchanged plan.
    result[`${target.host}:${target.profile ?? "default"}`] = !localPackages && requested === target.packageVersion
      ? requested : await driver.resolveTargetVersion(requested);
  }
  return result;
}

function retryCommand(request, action, platform) {
  if (request.operation === "factory-reset") {
    return formatCommand(["dev-flow", "factory-reset", "--host", "all", "--all-known-profiles",
      ...(request.reinstallAfterReset ? ["--reinstall"] : []), ...(request.permanent ? ["--permanent"] : [])], platform);
  }
  const args = ["dev-flow", action?.operation === "uninstall" ? "uninstall" : "repair", "--host", action?.host ?? request.host];
  if (action?.profile) args.push("--profile", action.profile);
  if (action?.targetVersion) args.push("--version", action.targetVersion);
  args.push("--yes");
  return formatCommand(args, platform);
}

// The desktop pet runs a Core runtime owned by an Adapter. A confirmed operation
// that changes that Adapter replaces the very binary the pet is running, so the
// pet is stopped first through the native entry that filters by `core_path`.
// An unconfirmed preview, a read-only status or doctor call, and maintenance of a
// different Adapter all leave the running pet untouched.
async function stopDesktopPetForMaintainedCores(request, plan, { paths, environment, dependencies, replaceDesktop = false }) {
  const stop = dependencies.stopPetForCore ?? stopPetForCore;
  const shutdown = {
    environment,
    homeDirectory: dependencies.homeDirectory,
    platform: paths.platform,
    arch: paths.arch,
  };
  if (request.operation === "factory-reset" || replaceDesktop) {
    // Reset removes every Adapter together with the pet directory, so any running
    // desktop instance is stopped before cleanup regardless of which Core it runs.
    await stop({ ...shutdown, corePath: null });
  }
  const maintained = plan.actions.filter((action) => action.owner === "codex" || action.owner === "deepseek");
  if (maintained.length === 0) return;
  const runtimes = await (dependencies.listAdapterCoreRuntimes ?? listAdapterCoreRuntimes)({ paths, environment });
  const maintenance = await loadMaintenancePlatform(paths.platform, paths.arch);
  for (const action of maintained) {
    const runtime = await maintenance.runtimeForAction(action, paths, environment, runtimes);
    if (runtime === undefined) continue;
    if (request.operation !== "factory-reset" && !replaceDesktop) await stop({ ...shutdown, corePath: runtime.runtimePath });
    await maintenance.prepareReplacement({ runtime, paths, environment });
  }
}

async function executeCleanup(request, observed, paths, dependencies) {
  const targets = [observed.resources.configuration, observed.resources.defaultData, observed.resources.pet].filter((target) => target.exists);
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
  }, {
    root: paths.configurationDirectory,
    enforcePrivateModes: paths.enforcePrivateModes,
  });
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
    .filter(Boolean)
    .map((target) => ({ host: target.host, profile: target.profile, package_version: target.packageVersion, core_version: target.coreVersion ?? null, state: target.state, host_available: target.hostAvailable ?? null, issues: target.issues ?? [] }));
  const states = targets.map((target) => target.state);
  const status = states.some((state) => ["partial", "incompatible", "conflicted", "unknown"].includes(state)) ? "partial"
    : states.length === 0 || states.every((state) => state === "absent") ? "absent"
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
      pet: observed.resources.pet.exists ? "present" : "absent",
      explicit_data: observed.resources.explicitData ? [observed.resources.explicitData.path] : [],
      trash_root: trashRoot,
    },
    completed_actions: completedActions,
    failed_action: null,
    next_steps: ["install", "repair", "upgrade", "reinstall"].includes(operation) && targets.some(target => target.host === "codex" && target.state === "ready") ? [CODEX_ACTIVATION_STEP] : [],
    restart_requirements: restartRequirements,
    confirmation: null,
    next_step: (["uninstall", "factory-reset"].includes(operation) && status === "absent" ? null : targets.filter(target => status === "absent" || target.state !== "absent").flatMap(target => target.issues).find(issue => issue.command)?.command) ??
      (status === "absent" && !["uninstall", "factory-reset"].includes(operation) ? "dev-flow install --host codex --yes" : status === "partial" ? "dev-flow doctor --host all" : operation === "status" && status === "ready" ? "dev-flow webui start" : null),
  };
}

function confirmationResult(request, plan, platform = process.platform) {
  const args = ["dev-flow", request.operation, "--host", request.host];
  for (const profile of request.profiles ?? []) args.push("--profile", profile);
  if (request.allKnownProfiles) args.push("--all-known-profiles");
  if (request.targetVersion) args.push("--version", request.targetVersion);
  for (const [field, flag] of [["adopt", "--adopt"], ["reinstallAfterReset", "--reinstall"], ["permanent", "--permanent"]]) if (request[field]) args.push(flag);
  if (plan.confirmationToken) args.push("--confirm-reset", plan.confirmationToken);
  if (plan.permanentToken) args.push("--confirm-permanent", plan.permanentToken);
  if (plan.downgradeToken) args.push("--confirm-downgrade", plan.downgradeToken);
  if (plan.confirmationClass === "mutation") args.push("--yes");
  for (const resource of plan.resources ?? []) if (request.operation === "factory-reset" && resource.label === "explicit-data") args.push("--confirm-explicit-data", resource.path);
  return {
    operation_id: null,
    operation: request.operation,
    status: "confirmation_required",
    changed: false,
    targets: plan.targets.map((target) => ({ host: target.host, profile: target.profile, package_version: target.packageVersion, core_version: null, state: target.state })),
    data: { policy: "preserve", configuration: "preserved", default_data: "preserved", pet: "preserved", explicit_data: [], trash_root: null },
    completed_actions: [],
    failed_action: null,
    restart_requirements: plan.restartRequirements,
    confirmation: {
      class: plan.confirmationClass,
      plan_id: plan.planId,
      token: plan.confirmationToken ?? plan.downgradeToken,
      permanent_token: plan.permanentToken,
      impacts: plan.impacts,
      resources: plan.resources,
      actions: plan.actions,
    },
    next_step: formatCommand(args, platform),
  };
}

function failureResult(operation, error) {
  return {
    operation_id: error.operationId ?? null,
    operation,
    error: { code: error.code ?? (error instanceof CLIError ? "INVALID_ARGUMENT" : "OPERATION_FAILED"), message: error.message, detail: String(error.stderr || error.cause?.stderr || error.cause?.message || "").trim().slice(0, 2048) },
    status: (error.changed ?? Boolean(error.completedSteps?.length)) ? "partial" : "failed",
    changed: error.changed ?? Boolean(error.completedSteps?.length),
    targets: [],
    data: { policy: error.dataPolicy ?? "preserve", configuration: "unknown", default_data: "unknown", pet: "unknown", explicit_data: [], trash_root: error.trashRoot ?? null },
    completed_actions: error.completedSteps ?? [],
    failed_action: error.failedAction ?? null,
    restart_requirements: [],
    confirmation: null,
    next_step: error.nextStep ?? (error instanceof CLIError ? "dev-flow help" : "dev-flow doctor --host all"),
  };
}
