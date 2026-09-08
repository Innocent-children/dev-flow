// Host launch discovery describes the existing coordinator operations. The coordinator owns execution.
const text = (description) => ({ type: "string", minLength: 1, description });
const path = (description) => text(`Normalized absolute path. ${description}`);
const nullablePath = (description) => ({ anyOf: [path(description), { type: "null" }], description });
const array = (items, description) => ({ type: "array", items, description });
const object = (properties, optional = []) => ({
  type: "object", additionalProperties: false, properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
});
const key = { ...text("Stable repository key confirmed by the user; keep the same key throughout this launch."), pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
const identity = {
  launch_id: text("Copy receipt.launch_id from prepare; reuse it for every repository of the same Task."),
  repository_key: key,
};
const source = path("Original source checkout, used to verify the saved repository identity.");
const receiptOutput = {
  receipt_path: "Absolute path of the retained Host provisioning record.",
  receipt: "Retained launch identity and operation_status. Read phase before choosing the next operation.",
};
const anchor = object({
  request_digest: text("Copy unchanged from host-launch inspect."),
  repositories: array(object({
    repository_key: key,
    canonical_root: path("Source root returned by inspect."),
    head: text("Source HEAD returned by inspect."),
    status_digest: text("Source status digest returned by inspect."),
    dirty_paths: array({ type: "string" }, "Bounded source dirty paths returned by inspect."),
    dirty_paths_truncated: { type: "boolean" },
  }), "Copy the complete repositories array from inspect, including all confirmed repositories."),
});
const hostResult = { description: "Complete original Host tool result, including its wrapper if present. Use null when the result was lost; never fabricate an ID." };
const cleanup = object({ ...identity, source_repository_path: source, terminal: { const: true }, authorized: { const: true } });

const contracts = {
  inspect: {
    description: "Read source repositories and return the assessment anchor without writing Git or a receipt.",
    input_schema: object({ request: text("Exact current request; retain the same string for prepare."), repositories: { ...array(object({ key, repository_path: source }), "All proposed repositories."), minItems: 1, maxItems: 8 } }),
    output_fields: { request_digest: "Request identity.", repositories: "Canonical roots, HEADs, status digests and bounded dirty paths. Pass this entire result as prepare.assessment_anchor." },
    next_step: "Complete assessment and obtain the user's execution and workspace choices before prepare.",
  },
  prepare: {
    description: "After user confirmation, save the launch material and receipt, fetch the selected base and freeze its commit.",
    input_schema: object({
      request: text("Same exact request supplied to inspect."), assessment_anchor: anchor,
      ...identity, repository_path: source,
      remote_name: text("Confirmed Git remote name."), base_branch: text("Confirmed branch name on that remote."),
      target_branch: text("Confirmed new task branch name."),
      surface: { enum: ["managed_worktree", "cli_worktree"] },
      worktree_path: nullablePath("Required null for managed_worktree; required destination path for cli_worktree."),
      handoff_file: path("Complete JSON material prepared using references/task-handoff.md; existing user confirmations remain effective."),
    }, ["launch_id"]),
    output_fields: { ...receiptOutput, resumed: "Whether a retained preparation was found.", fetch_performed: "Whether this invocation fetched the base." },
    next_step: "Retain receipt.launch_id before preparing another repository. Only phase=fetched proceeds to dispatch-start or cli-provision; inspect status after uncertainty.",
  },
  status: {
    description: "Read one exact launch/repository record without repeating the operation.",
    input_schema: object(identity), output_fields: { ...receiptOutput, receipt: "Saved record, or null when this identity has no record." },
    next_step: "Use the retained phase and original Host operation/thread marker. An uncertain result never authorizes another dispatch.",
  },
  "dispatch-start": {
    description: "Record a managed-worktree dispatch attempt before calling Codex task creation.",
    input_schema: object({ ...identity, project_id: text("Codex saved-project ID returned by its project listing.") }),
    output_fields: { ...receiptOutput, should_dispatch: "Call the Host exactly once only when true.", host_request: "Exact Codex create_thread arguments, present only when should_dispatch=true." },
    next_step: "Forward host_request to the Host unchanged, then record the complete response with dispatch-result. For false, read status and the existing Host task.",
  },
  "dispatch-result": {
    description: "Record the complete Codex creation result, including structuredContent/result or a single JSON text content block. Save clientThreadId as queued and threadId as dispatched; tool errors, missing or malformed results record uncertainty.",
    input_schema: object({ ...identity, host_result: hostResult }), output_fields: { ...receiptOutput, changed: "Whether the record changed." },
    next_step: "Queued/clientThreadId results require Host inspection, never another create_thread. The destination session consumes the receipt with bootstrap.",
  },
  bootstrap: {
    description: "Verify the destination managed worktree and create the confirmed target branch.",
    input_schema: object({ ...identity, worktree_path: path("Actual destination worktree discovered from the Host.") }),
    output_fields: { ...receiptOutput, workspace_origin: "Verified origin for this repository; use scope after all repositories are provisioned." },
    next_step: "After every confirmed repository is provisioned, call scope once with the complete repository key set before opening the Core Task.",
  },
  "cli-provision": {
    description: "Create the confirmed CLI worktree and return the relaunch argv using retained requirements.",
    input_schema: object({ ...identity, source_repository_path: source, additional_worktree_paths: { ...array(path("Verified additional Task worktree."), "Already provisioned additional roots; use [] for one repository."), maxItems: 7 } }),
    output_fields: { ...receiptOutput, workspace_origin: "Verified origin.", relaunch: "{executable, arguments}; arguments include -C, each --add-dir and the saved bootstrap prompt." },
    next_step: "Launch the returned argv after all roots are prepared and authorized. The destination reads scope before Core Task creation.",
  },
  scope: {
    description: "Read and validate the complete set of provisioned records for one Task and build its Core repository arguments.",
    input_schema: object({ launch_id: identity.launch_id, repository_keys: { ...array(key, "Every confirmed repository, including the primary."), minItems: 1, maxItems: 8, uniqueItems: true }, primary_repository_key: key }),
    output_fields: { repository_path: "Primary Task worktree.", workspace_origin: "Primary verified origin.", primary_repository_key: "Present for multiple repositories.", additional_repositories: "Present for multiple repositories; closed {key,repository_path,workspace_origin} entries." },
    next_step: "Use the complete result as the repository fields of dev_flow_open_task; add host and new_task from the admitted request. Core re-observes every worktree.",
  },
  "handoff-start": {
    description: "Record one Host handoff attempt after Core prepares relocation.",
    input_schema: object({ ...identity, relocation_id: text("Copy from dev_flow_prepare_task_relocation.result.relocation_id."), thread_id: text("Other Codex task being moved; the calling task cannot move itself.") }),
    output_fields: { ...receiptOutput, should_dispatch: "Call the Host handoff only when true.", host_request: "Exact handoff_thread arguments when should_dispatch=true." },
    next_step: "Call handoff_thread once and record its complete result using handoff-result.",
  },
  "handoff-result": {
    description: "Retain the Host handoff operation identity or an uncertain result.",
    input_schema: object({ ...identity, host_result: hostResult }), output_fields: { ...receiptOutput, changed: "Whether the record changed." },
    next_step: "Poll the retained host_operation_id with the Host and save each changed result through handoff-status; never redispatch.",
  },
  "handoff-status": {
    description: "Save a polled Host handoff status and the actual destination path.",
    input_schema: object({ ...identity, status: { enum: ["succeeded", "failed", "pending"] }, revision: { type: "integer", minimum: 0, description: "Host operation revision, not Core Task revision." }, worktree_path: nullablePath("Actual destination path, or null while unavailable.") }),
    output_fields: { ...receiptOutput, changed: "Whether the record changed.", relocation_id: "Retained Core relocation ID when updated." },
    next_step: "Only after Host success, resolve the Core relocation blocker with the exact destination paths.",
  },
  "cleanup-decision": {
    description: "Read-only cleanup eligibility from current Core and Git facts; this does not authorize deletion.",
    input_schema: object({ lifecycle: text("Current Core cursor, such as DONE or CANCELLED."), surface: { enum: ["managed_worktree", "cli_worktree"] }, clean: { type: "boolean" }, pushed: { type: "boolean" }, stateCertain: { type: "boolean" } }),
    output_fields: { automatic_cleanup: "Always false.", worktree_cleanup: "Keep, Host-owned cleanup or separate authorization requirement.", branch_cleanup: "Keep, Host-owned cleanup or separate authorization requirement." },
    next_step: "Keep uncertain, active, dirty or unpushed resources. Worktree and branch deletion require separate current authorizations.",
  },
  "cleanup-worktree": {
    description: "Remove an exact clean terminal CLI worktree after explicit deletion authorization.",
    input_schema: cleanup, output_fields: { ...receiptOutput, changed: "Whether deletion completed now.", uncertain: "Inspect the original attempt when true; do not repeat deletion." },
    next_step: "Branch deletion requires its own authorization and completed worktree cleanup. Managed worktree cleanup belongs to the Host.",
  },
  "cleanup-branch": {
    description: "Safely delete the confirmed CLI task branch after worktree cleanup and separate authorization.",
    input_schema: cleanup, output_fields: { ...receiptOutput, changed: "Whether deletion completed now.", uncertain: "Inspect the original attempt when true; do not repeat deletion." },
    next_step: "Retain the resulting record; ordinary Git safe-deletion refusals remain effective.",
  },
};

export const HOST_LAUNCH_OPERATIONS = Object.freeze(Object.keys(contracts));

export function describeHostLaunchOperation(operation) {
  if (!Object.hasOwn(contracts, operation)) throw new Error(`unknown host-launch operation ${operation}`);
  return structuredClone({ operation, transport: "One closed JSON object on stdin; one JSON result on stdout; errors on stderr with nonzero exit.", ...contracts[operation] });
}

export function hostLaunchHelp(operation) {
  if (operation !== undefined) return `${JSON.stringify(describeHostLaunchOperation(operation), null, 2)}\n`;
  return `Usage: dev-flow-codex host-launch <operation>\nRead a complete operation contract: dev-flow-codex host-launch <operation> --help\n\n${HOST_LAUNCH_OPERATIONS.map((name) => `${name}: ${contracts[name].description}`).join("\n")}\n`;
}
