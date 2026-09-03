import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import { requestDigest, validateAdmissionAnchor } from "./task-admission.mjs";
import {
  createProvisioningReceipt,
  provisioningReceiptPath,
  readProvisioningReceipt,
  updateProvisioningReceipt,
  validateProvisioningReceipt,
  withProvisioningReceiptLock,
  writeProvisioningReceiptAtomic,
} from "./provisioning-receipt.mjs";
import {
  createCliWorktree,
  fetchFrozenBase,
  initializeManagedWorktree,
  inspectSourceRepository,
  preflightWorktreeSelection,
  removeCliWorktree,
  removeTaskBranch,
} from "./worktree-lifecycle.mjs";

const digestPattern = /^[0-9a-f]{64}$/u;

export async function prepareTaskLaunch(input, {
  productSupportRoot,
  enforcePrivateModes = true,
  runGit,
  now = () => new Date(),
  createLaunchId = randomUUID,
} = {}) {
  validatePrepareInput(input);
  const launchId = input.launch_id ?? createLaunchId();
  const currentRequestDigest = requestDigest(input.request);
  const assessmentAnchor = validateAdmissionAnchor(input.assessment_anchor);
  if (assessmentAnchor.request_digest !== currentRequestDigest) {
    throw new Error("launch request changed after suitability assessment");
  }
  const assessedRepository = assessmentAnchor.repositories.find((entry) => entry.repository_key === input.repository_key);
  if (assessedRepository === undefined) throw new Error("launch repository was not present in the suitability assessment");
  const path = provisioningReceiptPath(productSupportRoot, launchId, input.repository_key);
  const existing = await readProvisioningReceipt(path, { productSupportRoot });
  if (existing !== null) {
    assertInputMatchesReceipt(existing, input, currentRequestDigest);
    if (existing.operation_status.phase !== "confirmed") {
      return Object.freeze({ receipt_path: path, receipt: existing, resumed: true, fetch_performed: false });
    }
  }
  const source = await preflightWorktreeSelection({
    repositoryPath: input.repository_path,
    remoteName: input.remote_name,
    baseBranch: input.base_branch,
    targetBranch: input.target_branch,
    runGit,
  });
  const currentSource = await inspectSourceRepository(source.canonical_root, { runGit });
  if (
    assessedRepository.canonical_root !== currentSource.canonical_root ||
    assessedRepository.head !== currentSource.head ||
    assessedRepository.status_digest !== currentSource.status_digest
  ) {
    throw new Error("suitability assessment is stale; reassess before provisioning");
  }
  let initial = existing;
  if (initial === null) {
    initial = createProvisioningReceipt({
      launchId,
      requestDigest: currentRequestDigest,
      sourceRepositoryIdentity: source.source_repository_identity,
      repositoryKey: input.repository_key,
      remoteName: input.remote_name,
      baseBranch: input.base_branch,
      targetBranch: input.target_branch,
      worktreePath: input.worktree_path,
      surface: input.surface,
      createdAt: now().toISOString(),
    });
    try {
      await writeProvisioningReceiptAtomic(path, initial, {
        productSupportRoot,
        enforcePrivateModes,
        createOnly: true,
      });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const concurrent = await readProvisioningReceipt(path, { productSupportRoot });
      if (concurrent === null) throw error;
      assertInputMatchesReceipt(concurrent, input, currentRequestDigest);
      return Object.freeze({ receipt_path: path, receipt: concurrent, resumed: true, fetch_performed: false });
    }
  } else if (initial.source_repository_identity !== source.source_repository_identity) {
    throw new Error("source repository identity changed after the provisioning receipt was created");
  }
  try {
    return await withProvisioningReceiptLock(path, { productSupportRoot, enforcePrivateModes }, async () => {
      const current = await readProvisioningReceipt(path, { productSupportRoot });
      if (current === null) throw new Error("provisioning receipt disappeared before fetch");
      if (current.operation_status.phase !== "confirmed") {
        return Object.freeze({ receipt_path: path, receipt: current, resumed: true, fetch_performed: false });
      }
      const fetching = updateProvisioningReceipt(current, { phase: "fetching", values: {} });
      await writeProvisioningReceiptAtomic(path, fetching, { productSupportRoot, enforcePrivateModes });
      try {
        const fetched = await fetchFrozenBase({
          repositoryPath: source.canonical_root,
          remoteName: input.remote_name,
          baseBranch: input.base_branch,
          runGit,
        });
        if (fetched.source_repository_identity !== source.source_repository_identity) {
          throw new Error("source repository identity changed during fetch");
        }
        const complete = updateProvisioningReceipt(fetching, {
          phase: "fetched",
          values: { fetched_commit: fetched.fetched_commit },
        });
        await writeProvisioningReceiptAtomic(path, complete, { productSupportRoot, enforcePrivateModes });
        return Object.freeze({
          receipt_path: path,
          receipt: complete,
          resumed: existing !== null,
          fetch_performed: true,
          source_dirty: !source.clean,
          source_status_digest: source.status_digest,
        });
      } catch (error) {
        const failed = updateProvisioningReceipt(fetching, { phase: "failed", values: {} });
        await writeProvisioningReceiptAtomic(path, failed, { productSupportRoot, enforcePrivateModes }).catch(() => {});
        throw error;
      }
    });
  } catch (error) {
    if (error?.code !== "ELOCKED") throw error;
    const concurrent = await readProvisioningReceipt(path, { productSupportRoot });
    if (concurrent === null) throw error;
    return Object.freeze({ receipt_path: path, receipt: concurrent, resumed: true, fetch_performed: false });
  }
}

export async function beginManagedTaskDispatch(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "project_id", "request"], "managed dispatch input");
  assertNonEmpty(input.project_id, "project_id");
  assertNonEmpty(input.request, "request");
  return await withLockedReceipt(input, options, async (state) => {
    const receipt = state.receipt;
    if (["dispatching", "queued", "dispatched", "provisioning", "provisioned", "uncertain"].includes(receipt.operation_status.phase)) {
      return Object.freeze({ should_dispatch: false, receipt_path: state.path, receipt });
    }
    if (receipt.operation_status.phase !== "fetched" || receipt.operation_status.surface !== "managed_worktree") {
      throw new Error("managed dispatch requires one fetched managed-worktree receipt");
    }
    if (!requestDigestMatches(receipt, input.request)) throw new Error("managed dispatch request does not match the receipt");
    const attemptId = createHash("sha256")
      .update(`${receipt.launch_id}\0${receipt.repository_key}\0managed-dispatch`)
      .digest("hex");
    const dispatching = updateProvisioningReceipt(receipt, {
      phase: "dispatching",
      values: { dispatch_attempt_id: attemptId },
    });
    await persistReceipt(state.path, dispatching, options);
    return Object.freeze({
      should_dispatch: true,
      receipt_path: state.path,
      receipt: dispatching,
      host_request: Object.freeze({
        prompt: buildManagedBootstrapPrompt({
          launchId: receipt.launch_id,
          repositoryKey: receipt.repository_key,
          request: input.request,
        }),
        title: `Dev Flow ${receipt.launch_id} ${receipt.repository_key}`,
        target: Object.freeze({
          type: "project",
          projectId: input.project_id,
          environment: Object.freeze({
            type: "worktree",
            startingState: Object.freeze({
              type: "branch",
              branchName: `refs/remotes/${receipt.remote_name}/${receipt.base_branch}`,
            }),
          }),
        }),
      }),
    });
  });
}

export async function recordManagedTaskDispatch(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "host_result"], "managed dispatch result input");
  return await withLockedReceipt(input, options, async (state) => {
    if (![
      "dispatching",
      "queued",
      ...(state.receipt.operation_status.relocation_id === null ? ["uncertain"] : []),
    ].includes(state.receipt.operation_status.phase)) {
      return Object.freeze({ receipt_path: state.path, receipt: state.receipt, changed: false });
    }
    const result = normalizeHostCreationResult(input.host_result);
    const next = result.kind === "ready"
      ? updateProvisioningReceipt(state.receipt, {
        phase: "dispatched",
        values: { host_thread_id: result.threadId },
      })
      : result.kind === "queued"
        ? updateProvisioningReceipt(state.receipt, {
          phase: "queued",
          values: { host_client_thread_id: result.clientThreadId },
        })
        : updateProvisioningReceipt(state.receipt, { phase: "uncertain", values: {} });
    await persistReceipt(state.path, next, options);
    return Object.freeze({ receipt_path: state.path, receipt: next, changed: true });
  });
}

export async function bootstrapManagedTask(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "worktree_path"], "managed bootstrap input");
  assertAbsolutePath(input.worktree_path, "worktree_path");
  return await withLockedReceipt(input, options, async (state) => {
    const receipt = state.receipt;
    if (receipt.operation_status.phase === "provisioned") {
      return Object.freeze({
        receipt_path: state.path,
        receipt,
        workspace_origin: workspaceOriginFromReceipt(receipt),
      });
    }
    if (receipt.operation_status.surface !== "managed_worktree" || !["dispatching", "queued", "dispatched", "uncertain"].includes(receipt.operation_status.phase)) {
      throw new Error("managed bootstrap requires a dispatched or uncertain managed receipt");
    }
    const provisioning = updateProvisioningReceipt(receipt, {
      phase: "provisioning",
      values: { worktree_path: resolve(input.worktree_path) },
    });
    await persistReceipt(state.path, provisioning, options);
    try {
      const verified = await initializeManagedWorktree({
        worktreePath: input.worktree_path,
        fetchedCommit: provisioning.fetched_commit,
        targetBranch: provisioning.target_branch,
        sourceRepositoryIdentity: provisioning.source_repository_identity,
        runGit: options.runGit,
      });
      const provisioned = updateProvisioningReceipt(provisioning, {
        phase: "provisioned",
        values: { worktree_path: verified.canonical_root },
      });
      await persistReceipt(state.path, provisioned, options);
      return Object.freeze({
        receipt_path: state.path,
        receipt: provisioned,
        workspace_origin: workspaceOriginFromReceipt(provisioned),
      });
    } catch (error) {
      const failed = updateProvisioningReceipt(provisioning, { phase: "failed", values: {} });
      await persistReceipt(state.path, failed, options).catch(() => {});
      throw error;
    }
  });
}

export async function provisionCliTask(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "request", "additional_worktree_paths"], "CLI provision input");
  assertNonEmpty(input.request, "request");
  if (!Array.isArray(input.additional_worktree_paths)) throw new Error("additional_worktree_paths must be an array");
  for (const path of input.additional_worktree_paths) assertAbsolutePath(path, "additional worktree path");
  return await withLockedReceipt(input, options, async (state) => {
    const receipt = state.receipt;
    if (receipt.operation_status.phase === "provisioned") {
      return cliProvisionResult(state.path, receipt, input);
    }
    if (receipt.operation_status.phase !== "fetched" || receipt.operation_status.surface !== "cli_worktree" || receipt.worktree_path === null) {
      throw new Error("CLI provisioning requires one fetched receipt with a worktree path");
    }
    if (!requestDigestMatches(receipt, input.request)) throw new Error("CLI request does not match the receipt");
    const provisioning = updateProvisioningReceipt(receipt, { phase: "provisioning", values: {} });
    await persistReceipt(state.path, provisioning, options);
    try {
      const verified = await createCliWorktree({
        repositoryPath: options.sourceRepositoryPath,
        worktreePath: provisioning.worktree_path,
        fetchedCommit: provisioning.fetched_commit,
        targetBranch: provisioning.target_branch,
        sourceRepositoryIdentity: provisioning.source_repository_identity,
        runGit: options.runGit,
      });
      const provisioned = updateProvisioningReceipt(provisioning, {
        phase: "provisioned",
        values: { worktree_path: verified.canonical_root },
      });
      await persistReceipt(state.path, provisioned, options);
      return cliProvisionResult(state.path, provisioned, input);
    } catch (error) {
      const failed = updateProvisioningReceipt(provisioning, { phase: "failed", values: {} });
      await persistReceipt(state.path, failed, options).catch(() => {});
      throw error;
    }
  });
}

function cliProvisionResult(path, receipt, input) {
  if (!requestDigestMatches(receipt, input.request)) throw new Error("CLI request does not match the receipt");
  return Object.freeze({
    receipt_path: path,
    receipt,
    workspace_origin: workspaceOriginFromReceipt(receipt),
    relaunch: buildCliRelaunchDescriptor({
      worktreePath: receipt.worktree_path,
      additionalWorktreePaths: input.additional_worktree_paths,
      prompt: buildManagedBootstrapPrompt({
        launchId: receipt.launch_id,
        repositoryKey: receipt.repository_key,
        request: input.request,
      }),
    }),
  });
}

export function workspaceOriginFromReceipt(receipt) {
  const value = validateProvisioningReceipt(receipt);
  if (value.operation_status.phase !== "provisioned") throw new Error("workspace origin requires a provisioned receipt");
  return Object.freeze({
    mode: "dedicated_worktree",
    remote_name: value.remote_name,
    base_branch: value.base_branch,
    base_commit: value.fetched_commit,
    task_branch: value.target_branch,
    provisioning_receipt_id: provisioningReceiptID(value.launch_id, value.repository_key),
  });
}

export function provisioningReceiptID(launchId, repositoryKey) {
  assertNonEmpty(launchId, "launchId");
  assertNonEmpty(repositoryKey, "repositoryKey");
  return `codex-${createHash("sha256").update(`${launchId}\0${repositoryKey}`).digest("hex")}`;
}

export function buildOpenTaskRepositoryScope(receipts, { primaryRepositoryKey = "primary" } = {}) {
  if (!Array.isArray(receipts) || receipts.length === 0 || receipts.length > 8) {
    throw new Error("open Task scope requires one to eight provisioning receipts");
  }
  assertNonEmpty(primaryRepositoryKey, "primaryRepositoryKey");
  const entries = receipts.map((receipt) => {
    const value = validateProvisioningReceipt(receipt);
    if (value.operation_status.phase !== "provisioned" || value.worktree_path === null) {
      throw new Error("every repository must be provisioned before Core Task creation");
    }
    return {
      key: value.repository_key,
      repository_path: value.worktree_path,
      workspace_origin: workspaceOriginFromReceipt(value),
    };
  });
  if (new Set(entries.map((entry) => entry.key)).size !== entries.length) {
    throw new Error("open Task repository keys must be unique");
  }
  if (new Set(entries.map((entry) => entry.repository_path)).size !== entries.length) {
    throw new Error("open Task worktree paths must be unique");
  }
  if (new Set(receipts.map((entry) => entry.launch_id)).size !== 1 || new Set(receipts.map((entry) => entry.request_digest)).size !== 1) {
    throw new Error("open Task receipts must belong to one confirmed launch and request");
  }
  const primary = entries.find((entry) => entry.key === primaryRepositoryKey);
  if (primary === undefined) throw new Error("primary repository receipt is missing");
  const result = {
    repository_path: primary.repository_path,
    workspace_origin: primary.workspace_origin,
  };
  if (entries.length > 1) {
    result.primary_repository_key = primaryRepositoryKey;
    result.additional_repositories = entries
      .filter((entry) => entry.key !== primaryRepositoryKey)
      .sort((left, right) => left.key.localeCompare(right.key));
  }
  return Object.freeze(result);
}

export function buildCliRelaunchDescriptor({ worktreePath, additionalWorktreePaths = [], prompt } = {}) {
  assertAbsolutePath(worktreePath, "worktreePath");
  assertNonEmpty(prompt, "prompt");
  if (!Array.isArray(additionalWorktreePaths) || additionalWorktreePaths.length > 7) {
    throw new Error("additionalWorktreePaths must contain at most seven paths");
  }
  const arguments_ = ["-C", worktreePath];
  for (const path of additionalWorktreePaths) {
    assertAbsolutePath(path, "additional worktree path");
    arguments_.push("--add-dir", path);
  }
  arguments_.push("--", prompt);
  return Object.freeze({ executable: "codex", arguments: Object.freeze(arguments_) });
}

export async function beginTaskHandoff(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "relocation_id", "thread_id"], "handoff input");
  assertNonEmpty(input.relocation_id, "relocation_id");
  assertNonEmpty(input.thread_id, "thread_id");
  return await withLockedReceipt(input, options, async (state) => {
    const receipt = state.receipt;
    if (["handoff_dispatching", "handoff_pending"].includes(receipt.operation_status.phase)) {
      return Object.freeze({ should_dispatch: false, receipt_path: state.path, receipt });
    }
    if (["handoff_succeeded", "handoff_failed"].includes(receipt.operation_status.phase) && receipt.operation_status.relocation_id === input.relocation_id) {
      return Object.freeze({ should_dispatch: false, receipt_path: state.path, receipt });
    }
    if (!["provisioned", "handoff_succeeded", "handoff_failed"].includes(receipt.operation_status.phase)) {
      throw new Error("handoff requires a provisioned Task receipt");
    }
    const next = updateProvisioningReceipt(receipt, {
      phase: "handoff_dispatching",
      values: {
        relocation_id: input.relocation_id,
        host_operation_id: null,
        host_operation_revision: null,
      },
    });
    await persistReceipt(state.path, next, options);
    return Object.freeze({
      should_dispatch: true,
      receipt_path: state.path,
      receipt: next,
      host_request: Object.freeze({
        threadId: input.thread_id,
        followUpPrompt: `Resume Dev Flow relocation ${input.relocation_id}; inspect the Host result, then resolve the Core blocker with the exact destination repository paths.`,
      }),
    });
  });
}

export async function recordTaskHandoff(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "host_result"], "handoff result input");
  return await withLockedReceipt(input, options, async (state) => {
    if (![
      "handoff_dispatching",
      ...(state.receipt.operation_status.relocation_id === null ? [] : ["uncertain"]),
    ].includes(state.receipt.operation_status.phase)) {
      return Object.freeze({ receipt_path: state.path, receipt: state.receipt, changed: false });
    }
    const hostResult = normalizedStructuredResult(input.host_result);
    const operationId = hostResult?.operationId;
    const revision = hostResult?.revision;
    const valid = typeof operationId === "string" && operationId !== "" && Number.isSafeInteger(revision) && revision >= 0;
    const next = valid
      ? updateProvisioningReceipt(state.receipt, {
        phase: "handoff_pending",
        values: { host_operation_id: operationId, host_operation_revision: revision },
      })
      : updateProvisioningReceipt(state.receipt, { phase: "uncertain", values: {} });
    await persistReceipt(state.path, next, options);
    return Object.freeze({ receipt_path: state.path, receipt: next, changed: true });
  });
}

export async function recordTaskHandoffStatus(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "status", "revision", "worktree_path"], "handoff status input");
  if (!["succeeded", "failed", "pending"].includes(input.status)) throw new Error("handoff status is invalid");
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error("handoff revision is invalid");
  if (input.worktree_path !== null) assertAbsolutePath(input.worktree_path, "worktree_path");
  return await withLockedReceipt(input, options, async (state) => {
    if (state.receipt.operation_status.phase !== "handoff_pending") {
      return Object.freeze({ receipt_path: state.path, receipt: state.receipt, changed: false });
    }
    const phase = input.status === "succeeded" ? "handoff_succeeded" : input.status === "failed" ? "handoff_failed" : "handoff_pending";
    const values = { host_operation_revision: input.revision };
    if (input.worktree_path !== null) values.worktree_path = input.worktree_path;
    const next = updateProvisioningReceipt(state.receipt, { phase, values });
    await persistReceipt(state.path, next, options);
    return Object.freeze({
      receipt_path: state.path,
      receipt: next,
      changed: true,
      relocation_id: next.operation_status.relocation_id,
    });
  });
}

export function buildManagedBootstrapPrompt({ launchId, repositoryKey, request } = {}) {
  assertNonEmpty(launchId, "launchId");
  assertNonEmpty(repositoryKey, "repositoryKey");
  assertNonEmpty(request, "request");
  return [
    "$dev-flow-codex:dev-flow",
    `Resume the confirmed Dev Flow launch ${launchId} for repository ${repositoryKey}.`,
    "Before any Core call, consume the provisioning receipt, verify the fetched commit and task worktree, create the confirmed target branch when needed, and prove the worktree is clean.",
    request,
  ].join(" ");
}

export async function cleanupCliTaskWorktree(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "terminal", "authorized"], "worktree cleanup input");
  if (input.terminal !== true || input.authorized !== true) {
    throw new Error("worktree cleanup requires terminal state and explicit authorization");
  }
  return await withLockedReceipt(input, options, async (state) => {
    if (state.receipt.operation_status.surface !== "cli_worktree") {
      throw new Error("managed worktree cleanup belongs to the Codex Host");
    }
    if (state.receipt.operation_status.worktree_cleanup === "requested") {
      return Object.freeze({ changed: false, uncertain: true, receipt_path: state.path, receipt: state.receipt });
    }
    if (state.receipt.operation_status.worktree_cleanup === "completed") {
      return Object.freeze({ changed: false, uncertain: false, receipt_path: state.path, receipt: state.receipt });
    }
    const requested = updateProvisioningReceipt(state.receipt, {
      phase: state.receipt.operation_status.phase,
      values: { worktree_cleanup: "requested" },
    });
    await persistReceipt(state.path, requested, options);
    try {
      await removeCliWorktree({
        repositoryPath: options.sourceRepositoryPath,
        worktreePath: requested.worktree_path,
        sourceRepositoryIdentity: requested.source_repository_identity,
        terminal: input.terminal,
        authorized: input.authorized,
        runGit: options.runGit,
      });
      const completed = updateProvisioningReceipt(requested, {
        phase: "worktree_removed",
        values: { worktree_cleanup: "completed" },
      });
      await persistReceipt(state.path, completed, options);
      return Object.freeze({ changed: true, uncertain: false, receipt_path: state.path, receipt: completed });
    } catch (error) {
      const failed = updateProvisioningReceipt(requested, {
        phase: requested.operation_status.phase,
        values: { worktree_cleanup: "failed" },
      });
      await persistReceipt(state.path, failed, options).catch(() => {});
      throw error;
    }
  });
}

export async function cleanupTaskBranch(input, options = {}) {
  assertExactKeys(input, ["launch_id", "repository_key", "terminal", "authorized"], "branch cleanup input");
  if (input.terminal !== true || input.authorized !== true) {
    throw new Error("branch cleanup requires separate explicit authorization");
  }
  return await withLockedReceipt(input, options, async (state) => {
    if (state.receipt.operation_status.surface !== "cli_worktree") {
      throw new Error("managed branch cleanup belongs to the Codex Host");
    }
    if (state.receipt.operation_status.branch_cleanup === "requested") {
      return Object.freeze({ changed: false, uncertain: true, receipt_path: state.path, receipt: state.receipt });
    }
    if (state.receipt.operation_status.branch_cleanup === "completed") {
      return Object.freeze({ changed: false, uncertain: false, receipt_path: state.path, receipt: state.receipt });
    }
    if (state.receipt.operation_status.worktree_cleanup !== "completed") {
      throw new Error("branch cleanup requires completed worktree cleanup");
    }
    const requested = updateProvisioningReceipt(state.receipt, {
      phase: state.receipt.operation_status.phase,
      values: { branch_cleanup: "requested" },
    });
    await persistReceipt(state.path, requested, options);
    try {
      await removeTaskBranch({
        repositoryPath: options.sourceRepositoryPath,
        targetBranch: requested.target_branch,
        sourceRepositoryIdentity: requested.source_repository_identity,
        terminal: input.terminal,
        authorized: input.authorized,
        runGit: options.runGit,
      });
      const completed = updateProvisioningReceipt(requested, {
        phase: "branch_removed",
        values: { branch_cleanup: "completed" },
      });
      await persistReceipt(state.path, completed, options);
      return Object.freeze({ changed: true, uncertain: false, receipt_path: state.path, receipt: completed });
    } catch (error) {
      const failed = updateProvisioningReceipt(requested, {
        phase: requested.operation_status.phase,
        values: { branch_cleanup: "failed" },
      });
      await persistReceipt(state.path, failed, options).catch(() => {});
      throw error;
    }
  });
}

async function withLockedReceipt(input, options, operation) {
  const path = provisioningReceiptPath(options.productSupportRoot, input.launch_id, input.repository_key);
  return await withProvisioningReceiptLock(path, {
    productSupportRoot: options.productSupportRoot,
    enforcePrivateModes: options.enforcePrivateModes ?? true,
  }, async () => {
    const receipt = await readProvisioningReceipt(path, { productSupportRoot: options.productSupportRoot });
    if (receipt === null) throw new Error("provisioning receipt does not exist");
    return await operation({ path, receipt });
  });
}

async function persistReceipt(path, receipt, options) {
  return await writeProvisioningReceiptAtomic(path, receipt, {
    productSupportRoot: options.productSupportRoot,
    enforcePrivateModes: options.enforcePrivateModes ?? true,
  });
}

function normalizeHostCreationResult(value) {
  const result = normalizedStructuredResult(value);
  if (result && typeof result.threadId === "string" && result.threadId !== "") {
    return { kind: "ready", threadId: result.threadId };
  }
  if (result && typeof result.clientThreadId === "string" && result.clientThreadId !== "") {
    return { kind: "queued", clientThreadId: result.clientThreadId };
  }
  return { kind: "uncertain" };
}

function normalizedStructuredResult(value) {
  return value?.structuredContent?.result ?? value?.structuredContent ?? value?.result ?? value;
}

function validatePrepareInput(value) {
  const keys = [
    "request", "assessment_anchor", "repository_key", "repository_path", "remote_name", "base_branch", "target_branch",
    "surface", "worktree_path",
  ];
  if (Object.hasOwn(value ?? {}, "launch_id")) keys.push("launch_id");
  assertExactKeys(value, keys, "launch preparation input");
  assertNonEmpty(value.request, "request");
  assertNonEmpty(value.repository_key, "repository_key");
  assertAbsolutePath(value.repository_path, "repository_path");
  assertNonEmpty(value.remote_name, "remote_name");
  assertNonEmpty(value.base_branch, "base_branch");
  assertNonEmpty(value.target_branch, "target_branch");
  if (!["managed_worktree", "cli_worktree"].includes(value.surface)) throw new Error("surface is invalid");
  if (value.surface === "cli_worktree") assertAbsolutePath(value.worktree_path, "worktree_path");
  if (value.surface === "managed_worktree" && value.worktree_path !== null) {
    throw new Error("managed worktree path must be discovered from the Host");
  }
  if (Object.hasOwn(value, "launch_id")) assertNonEmpty(value.launch_id, "launch_id");
}

function assertInputMatchesReceipt(receipt, input, requestDigest) {
  const requested = {
    launch_id: input.launch_id,
    request_digest: requestDigest,
    repository_key: input.repository_key,
    remote_name: input.remote_name,
    base_branch: input.base_branch,
    target_branch: input.target_branch,
    requested_worktree_path: input.worktree_path,
    surface: input.surface,
  };
  const retained = {
    launch_id: receipt.launch_id,
    request_digest: receipt.request_digest,
    repository_key: receipt.repository_key,
    remote_name: receipt.remote_name,
    base_branch: receipt.base_branch,
    target_branch: receipt.target_branch,
    requested_worktree_path: receipt.operation_status.surface === "managed_worktree" ? null : receipt.worktree_path,
    surface: receipt.operation_status.surface,
  };
  if (stableJSON(requested) !== stableJSON(retained)) {
    throw new Error("launch identity conflicts with the existing provisioning receipt");
  }
}

function assertExactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (stableJSON(Object.keys(value).sort()) !== stableJSON([...keys].sort())) throw new Error(`${label} has an invalid closed shape`);
}

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) throw new Error(`${label} must be a non-empty string`);
}

function assertAbsolutePath(value, label) {
  if (typeof value !== "string" || value.includes("\0") || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a normalized absolute path`);
  }
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function validateWorkspaceOrigin(value) {
  assertExactKeys(value, ["mode", "remote_name", "base_branch", "base_commit", "task_branch", "provisioning_receipt_id"], "workspace origin");
  if (value.mode !== "dedicated_worktree") throw new Error("workspace origin mode is invalid");
  for (const field of ["remote_name", "base_branch", "task_branch", "provisioning_receipt_id"]) assertNonEmpty(value[field], field);
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value.base_commit)) throw new Error("workspace origin base_commit is invalid");
  return structuredClone(value);
}

export function requestDigestMatches(receipt, request) {
  const value = validateProvisioningReceipt(receipt);
  return digestPattern.test(value.request_digest) && value.request_digest === createHash("sha256").update(request, "utf8").digest("hex");
}
