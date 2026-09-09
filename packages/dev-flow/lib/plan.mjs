import { planDigest } from "./ownership.mjs";

const versionedOperations = new Set(["install", "upgrade", "repair", "reinstall"]);

export function createLifecyclePlan(request, observed, {
  targetVersions = {},
  planId = null,
  token = null,
  now = () => new Date(),
  platformKey = "darwin-arm64",
  recoverableCleanupDescription = "Move confirmed data to macOS Trash",
  replaceLocalPackages = false,
  installDesktopPet = false,
} = {}) {
  if (request.operation === "factory-reset" && request.host !== "all") {
    throw planConflict("factory reset requires --host all because Task data is shared");
  }
  const targets = selectTargets(request, observed);
  const actions = [];
  let downgrade = false;

  if (request.operation === "factory-reset") {
    const unselected = (observed.knownDeepSeekProfiles ?? []).filter((profile) => !targets.some((target) => target.host === "deepseek" && target.profile === profile));
    if (unselected.length > 0) throw planConflict("factory reset requires every manager-owned DeepSeek Profile");
    for (const target of targets) {
      if (requiresUninstall(target)) actions.push(actionFor(target, "uninstall", null));
    }
    if (request.reinstallAfterReset || actions.length || Object.values(observed.resources).some(resource => resource?.exists)) actions.push({ actionId: "manager.cleanup", owner: "manager", operation: "cleanup", host: "manager", profile: null, targetVersion: null });
    if (request.reinstallAfterReset) {
      actions.push({ actionId: "manager.initialize_fresh_state", owner: "manager", operation: "initialize", host: "manager", profile: null, targetVersion: null });
      for (const target of targets) actions.push(actionFor(target, "install", targetVersions[targetKey(target)]));
    }
  } else if (versionedOperations.has(request.operation)) {
    for (const target of targets) {
      const targetVersion = targetVersions[targetKey(target)];
      if (!targetVersion) throw new Error(`target version is missing for ${targetKey(target)}`);
      if (target.packageVersion && compareVersions(target.packageVersion, targetVersion) > 0) downgrade = true;
      const alreadyReady = target.state === "ready" && target.packageVersion === targetVersion;
      if (replaceLocalPackages || request.operation === "reinstall" || request.adopt || !alreadyReady) actions.push(actionFor(target, request.operation, targetVersion));
    }
  } else if (request.operation === "uninstall") {
    for (const target of targets) if (requiresUninstall(target)) actions.push(actionFor(target, "uninstall", null));
  }

  if (installDesktopPet && (versionedOperations.has(request.operation) || request.reinstallAfterReset)) {
    actions.push({ actionId: "pet.install", owner: "manager", operation: "install_pet", host: "manager", profile: null, targetVersion: null });
  }

  const observedIdentity = {
    targets: targets.map((target) => ({ host: target.host, profile: target.profile, state: target.state, packageInstalled: target.packageInstalled === true, packageVersion: target.packageVersion, receipt: Boolean(target.receipt) })),
    resources: observed.resources,
  };
  const observedDigest = planDigest(observedIdentity);
  const stablePlanIdentity = planDigest({
    operation: request.operation,
    host: request.host,
    profiles: request.profiles,
    allKnownProfiles: request.allKnownProfiles,
    targetVersion: request.targetVersion,
    reinstallAfterReset: request.reinstallAfterReset,
    permanent: request.permanent,
    adopt: request.adopt,
    platformKey,
    observedDigest,
    actions,
  });
  const resolvedPlanId = planId ?? `plan-${stablePlanIdentity.slice(0, 20)}`;
  const confirmationClass = actions.length === 0 ? "none" : request.operation === "factory-reset"
    ? request.permanent ? "permanent_reset" : "reset"
    : downgrade ? "downgrade"
      : actions.length > 0 ? "mutation" : "none";
  const tokenValue = token ? token() : stablePlanIdentity.slice(0, 6).toUpperCase();
  const confirmationToken = confirmationClass === "reset" || confirmationClass === "permanent_reset" ? `RESET-${tokenValue}` : null;
  const permanentToken = confirmationClass === "permanent_reset" ? `PERMANENT-${stablePlanIdentity.slice(6, 12).toUpperCase()}` : null;
  const downgradeToken = confirmationClass === "downgrade" ? `DOWNGRADE-${tokenValue}` : null;
  const core = {
    planId: resolvedPlanId,
    operation: request.operation,
    host: request.host,
    targets: targets.map((target) => ({ host: target.host, profile: target.profile, state: target.state, packageInstalled: target.packageInstalled === true, packageVersion: target.packageVersion })),
    actions,
    impacts: impactsFor(request, targets, observed, actions, recoverableCleanupDescription),
    restartRequirements: actions.filter(action => action.owner === "deepseek" && action.operation !== "uninstall").map(action => `Restart DeepSeek Profile ${action.profile}`),
    resources: Object.values(observed.resources).filter(resource => resource?.exists).map(({ label, path }) => ({ label, path })),
    confirmationClass,
    observedDigest,
  };
  return Object.freeze({
    ...core,
    digest: planDigest(core),
    createdAt: now().toISOString(),
    confirmationToken,
    permanentToken,
    downgradeToken,
  });
}

function selectTargets(request, observed) {
  const targets = [];
  if (request.host === "codex" || request.host === "all") targets.push(observed.codex);
  if (request.host === "deepseek" || request.host === "all") {
    const requestedProfiles = request.allKnownProfiles
      ? [...new Set([...(observed.knownDeepSeekProfiles ?? []), ...request.profiles, ...observed.deepseek.map(target => target.profile)])]
      : request.profiles;
    for (const profile of requestedProfiles) {
      const target = observed.deepseek.find((entry) => entry.profile === profile);
      if (!target) throw new Error(`DeepSeek Profile ${profile} was not observed`);
      targets.push(target);
    }
  }
  return targets;
}

function actionFor(target, operation, targetVersion) {
  return {
    actionId: `${target.host}.${target.profile ?? "default"}.${operation}`,
    owner: target.host,
    operation,
    host: target.host,
    profile: target.profile,
    targetVersion,
  };
}

function impactsFor(request, targets, observed, actions, recoverableCleanupDescription) {
  if (["status", "doctor"].includes(request.operation)) return ["Read Host and Adapter state only"];
  const affectedTargets = request.operation === "factory-reset"
    ? targets.filter((target) => actions.some((action) => action.owner === target.host && action.profile === target.profile))
    : targets;
  const impacts = affectedTargets.map((target) => `${request.operation} ${target.host}${target.profile ? ` Profile ${target.profile}` : " Adapter"}`);
  if (request.operation === "factory-reset") {
    if (actions.some((action) => action.operation === "uninstall")) impacts.push("Remove every installed Adapter before shared data cleanup");
    if (observed.resources.configuration.exists) impacts.push("Clear Dev Flow user configuration");
    if (observed.resources.defaultData.exists) impacts.push("Clear current default Task data");
    if (observed.resources.pet.exists) impacts.push("Clear desktop pet records, preferences, and imported appearances");
    if (observed.resources.explicitData?.exists) impacts.push("Clear the explicitly confirmed Task data directory");
    if (observed.resources.configuration.exists || observed.resources.defaultData.exists || observed.resources.pet.exists || observed.resources.explicitData?.exists) {
      impacts.push(request.permanent ? "Permanently remove confirmed data" : recoverableCleanupDescription);
    }
    if (request.reinstallAfterReset) impacts.push("Create fresh state and reinstall selected Adapters");
    if (impacts.length === 0) impacts.push("No installed Adapter or active Dev Flow data was found");
  } else {
    impacts.push("Preserve Dev Flow user configuration and Task data");
  }
  if (actions.some(action => action.operation === "install_pet")) impacts.push("Update desktop pet application; preserve settings and appearances");
  return impacts;
}

function requiresUninstall(target) {
  return target.state !== "absent" || target.packageInstalled === true;
}

function targetKey(target) {
  return `${target.host}:${target.profile ?? "default"}`;
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function planConflict(message) {
  const error = new Error(message);
  error.exitCode = 4;
  return error;
}
