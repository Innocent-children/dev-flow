import { planDigest } from "./ownership.mjs";

const versionedOperations = new Set(["install", "upgrade", "repair", "reinstall"]);

export function createLifecyclePlan(request, observed, {
  targetVersions = {},
  planId = null,
  token = null,
  now = () => new Date(),
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
      if (target.state !== "absent") actions.push(actionFor(target, "uninstall", null));
    }
    actions.push({ actionId: "manager.cleanup", owner: "manager", operation: "cleanup", host: "manager", profile: null, targetVersion: null });
    if (request.reinstallAfterReset) {
      actions.push({ actionId: "manager.initialize_fresh_state", owner: "manager", operation: "initialize", host: "manager", profile: null, targetVersion: null });
      for (const target of targets) actions.push(actionFor(target, "install", targetVersions[targetKey(target)]));
    }
  } else if (versionedOperations.has(request.operation)) {
    for (const target of targets) {
      const targetVersion = targetVersions[targetKey(target)];
      if (!targetVersion) throw new Error(`target version is missing for ${targetKey(target)}`);
      if (request.operation === "upgrade" && target.packageVersion && compareVersions(target.packageVersion, targetVersion) > 0) downgrade = true;
      const alreadyReady = target.state === "ready" && target.packageVersion === targetVersion;
      if (request.operation === "reinstall" || request.adopt || !alreadyReady) actions.push(actionFor(target, request.operation, targetVersion));
    }
  } else if (request.operation === "uninstall") {
    for (const target of targets) if (target.state !== "absent") actions.push(actionFor(target, "uninstall", null));
  }

  const observedIdentity = {
    targets: targets.map((target) => ({ host: target.host, profile: target.profile, state: target.state, packageVersion: target.packageVersion, receipt: Boolean(target.receipt) })),
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
    observedDigest,
    actions,
  });
  const resolvedPlanId = planId ?? `plan-${stablePlanIdentity.slice(0, 20)}`;
  const confirmationClass = request.operation === "factory-reset"
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
    targets: targets.map((target) => ({ host: target.host, profile: target.profile, state: target.state, packageVersion: target.packageVersion })),
    actions,
    impacts: impactsFor(request, targets, observed),
    restartRequirements: targets.filter((target) => target.host === "deepseek" && actions.length > 0).map((target) => `Restart DeepSeek Profile ${target.profile}`),
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
      ? [...new Set([...(observed.knownDeepSeekProfiles ?? []), ...request.profiles])]
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

function impactsFor(request, targets, observed) {
  if (["status", "doctor"].includes(request.operation)) return ["Read Host and Adapter state only"];
  const impacts = targets.map((target) => `${request.operation} ${target.host}${target.profile ? ` Profile ${target.profile}` : " Adapter"}`);
  if (request.operation === "factory-reset") {
    impacts.push("Remove every included Adapter before shared data cleanup");
    if (observed.resources.configuration.exists) impacts.push("Clear Dev Flow user configuration");
    if (observed.resources.defaultData.exists) impacts.push("Clear current default Task data");
    if (observed.resources.explicitData?.exists) impacts.push("Clear the explicitly confirmed Task data directory");
    impacts.push(request.permanent ? "Permanently remove confirmed data" : "Move confirmed data to macOS Trash");
    if (request.reinstallAfterReset) impacts.push("Create fresh state and reinstall selected Adapters");
  } else {
    impacts.push("Preserve Dev Flow user configuration and Task data");
  }
  return impacts;
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
