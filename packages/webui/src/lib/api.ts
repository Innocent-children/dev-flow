export type Readiness = "ready" | "read_only" | "incompatible" | "unavailable";
export type Lifecycle = "active" | "blocked" | "done" | "cancelled";

export interface TaskSummary {
  task_id: string;
  request_summary: string;
  origin_host: string;
  execution_host: string;
  current_node: string;
  lifecycle: Lifecycle;
  revision: number;
  updated_at: string;
  archived: boolean;
  repository_keys: string[];
  repository_group_id: string;
  worktree_path: string;
  blocker: string | null;
  outcome: string | null;
}

export interface DashboardResponse {
  ok: true;
  request_id: string;
  readiness: Readiness;
  counts: { lifecycle: Lifecycle; count: number }[];
  recent: TaskSummary[];
}

export interface TaskListResponse {
  ok: true;
  request_id: string;
  readiness: Readiness;
  page: number;
  has_next: boolean;
  items: TaskSummary[];
}

export interface SystemStatusResponse {
  ok: true;
  request_id: string;
  readiness: Readiness;
  core_identity: string;
  data_root_digest: string;
  url: string;
}

export interface FilterOptionsResponse { ok: true; request_id: string; node_ids: string[] }

export interface Fact { kind: string; label: string; value: string }
export interface TaskEventView {
  revision: number;
  event_type: string;
  source_node: string;
  destination_node: string;
  transition_id: string | null;
  reason: string | null;
  repository_delta_paths: string[];
  created_at: string;
}
export interface GraphView {
  process_id: string;
  definition_digest: string;
  current_node: string;
  resume_node: string | null;
  nodes: { node_id: string; kind: string; purpose: string }[];
  transitions: { transition_id: string; source: string; destination: string }[];
  actual_transition_ids: string[];
  current_legal_transition_ids: string[];
  future_node_ids: string[];
  future_transition_ids: string[];
}
export interface ActionView {
  action_id: string;
  action_kind: string;
  process_id: string;
  process_definition_digest: string;
  source_node: string;
  repository_binding_digest: string;
  issuance_identity_digest: string;
  issuance_history_digest: string;
  issuance_content_digest: string;
  purpose: string;
  conditions: string[];
  allowed_effects: string[];
  required_evidence: string[];
  method_steps: string[];
  legal_transition_ids: string[];
  payload_schema: JSONSchema;
}

export interface JSONSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  const?: string | number | boolean;
  enum?: (string | number | boolean)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
}
export interface TaskDetailResponse {
  ok: true;
  request_id: string;
  readiness: Readiness;
  summary: TaskSummary;
  intent: string;
  acceptance_criteria: string[];
  verification_budget: string;
  method_profile: string;
  repositories: RepositoryView[];
  baselines: Fact[];
  records: Fact[];
  evidence: Fact[];
  blocker: Fact | null;
  outcome: Fact | null;
  events: TaskEventView[];
  graph: GraphView;
  current_action: ActionView | null;
  file_scope: {
    expected_paths: string[];
    current_changed_paths: string[];
    unexplained_paths: string[];
    covered_host_tools: string[];
    decision_count: number;
    final_check_enabled: boolean;
  };
  workspace: WorkspaceView;
}

export interface ChangedEntryView {
  path: string;
  change_type: string;
  file_mode: string;
  gitlink: boolean;
  content_digest: string;
}

export interface RepositoryView {
  key: string;
  path: string;
  role: "primary" | "additional";
  repository_group_id: string;
  workspace_origin: {
    mode: "dedicated_worktree";
    remote_name: string;
    base_branch: string;
    base_commit: string;
    task_branch: string;
    provisioning_receipt_id: string;
  };
  workspace_observation: {
    worktree_instance_digest: string;
    identity_digest: string;
    history_digest: string;
    content_digest: string;
    current_branch: string | null;
    detached: boolean;
    current_head: string;
    head_tree: string;
    history_relation: string;
    base_commit_ancestor: boolean;
    changed_entries: ChangedEntryView[];
    task_surface: ChangedEntryView[];
    observed_at: string;
    binding_digest: string;
  };
}

export interface WorkspaceView {
  provisioning_status: "last_known" | "unavailable";
  current_changed_paths: string[];
  history_conflict: boolean;
  relocation: { pending: boolean; relocation_id: string | null; resume_node: string | null };
  cleanup: { automatic: false; host_action_required: true; separate_worktree_and_branch: true; terminal: boolean };
}

export interface FailureResponse {
  ok: false;
  request_id: string;
  workflow_write_state: "not_committed" | "unknown";
  error: { code: string; message: string; field_paths: string[]; guard_id: string | null };
  recovery: RecoveryAdvice;
}

export interface RecoveryAdvice { action: RecoveryAction; retry_safe: boolean; message: string }
export type RecoveryAction = "none" | "correct_current_action" | "retry_current_action" | "submit_recovery_apply" | "read_next_action" | "resolve_blocker" | "stop_for_repository_drift";

export interface OperationProbe {
  operation_id: string;
  expected_revision: number;
  action_id: string;
  action_kind: string;
  process_id: string;
  process_definition_digest: string;
  source_node: string;
  repository_binding_digest: string;
  issuance_identity_digest: string;
  issuance_history_digest: string;
  issuance_content_digest: string;
  payload: Record<string, unknown>;
}

export class APIError extends Error {
  constructor(public readonly failure: FailureResponse) {
    super(failure.error.message);
  }
}

export interface MutationResponse {
  ok: true;
  request_id: string;
  workflow_write_state: "committed" | "not_committed";
  task_revision: number | null;
  redirect: string | null;
  recovery: RecoveryAdvice | null;
  relocation_id: string | null;
}

export interface ResumeTaskInput {
  execution_host: "codex" | "deepseek";
  repository_path: string;
}

async function readJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  const body = (await response.json()) as T | FailureResponse;
  if (!response.ok || (body as FailureResponse).ok === false) {
    const failure = body as FailureResponse;
    throw new Error(failure.error?.message ?? translateCurrent("api.requestFailed", { status: response.status }));
  }
  return body as T;
}

function sessionValue(): string {
  const value = document.querySelector<HTMLMetaElement>('meta[name="dev-flow-session"]')?.content;
  if (value === undefined || value === "") throw new Error(translateCurrent("api.session"));
  return value;
}

async function postJSON(path: string, body: Record<string, unknown>): Promise<MutationResponse> {
  const response = await fetch(path, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ...body, csrf: sessionValue() }) });
  const result = (await response.json()) as MutationResponse | FailureResponse;
  if (!response.ok || result.ok === false) {
    const failure = result as FailureResponse;
    if (failure.error !== undefined) throw new APIError(failure);
    throw new Error(translateCurrent("api.requestFailed", { status: response.status }));
  }
  return result;
}

function requestID(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function getDashboard(signal?: AbortSignal) {
  return readJSON<DashboardResponse>("/api/dashboard", signal);
}

export function getTasks(query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size === 0 ? "" : `?${query.toString()}`;
  return readJSON<TaskListResponse>(`/api/tasks${suffix}`, signal);
}

export function getTask(taskID: string, signal?: AbortSignal) {
  return readJSON<TaskDetailResponse>(`/api/tasks/${encodeURIComponent(taskID)}`, signal);
}

export function getSystemStatus(signal?: AbortSignal) {
  return readJSON<SystemStatusResponse>("/api/system/status", signal);
}

export function getFilterOptions(signal?: AbortSignal) {
  return readJSON<FilterOptionsResponse>("/api/system/filter-options", signal);
}

export function resumeTask(input: ResumeTaskInput) {
  return postJSON("/api/tasks/resume", { request_id: requestID("resume"), ...input });
}

export function prepareTaskRelocation(taskID: string, revision: number, executionHost: string) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/relocation/prepare`, { request_id: requestID("relocation"), task_revision: revision, execution_host: executionHost, confirmed: true });
}

export function abandonTask(taskID: string, revision: number, executionHost: string, reason: string) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/abandon`, { request_id: requestID("abandon"), task_revision: revision, execution_host: executionHost, reason, confirmed: true });
}

export function cancelTask(taskID: string, revision: number, reason: string) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/cancel`, { request_id: requestID("cancel"), task_revision: revision, reason, confirmed: true });
}

export function setTaskArchived(taskID: string, revision: number, archived: boolean) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/archive`, { request_id: requestID("archive"), task_revision: revision, archived });
}

export function purgeTask(taskID: string, revision: number, typedTaskID: string, reason: string) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/purge`, { request_id: requestID("purge"), task_revision: revision, typed_task_id: typedTaskID, reason, irreversible: true });
}

export function submitCurrentAction(taskID: string, revision: number, action: ActionView, payload: Record<string, unknown>, operationID = requestID("action")) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/actions/submit`, {
    request_id: operationID,
    task_revision: revision,
    action_id: action.action_id,
    action_kind: action.action_kind,
    process_id: action.process_id,
    process_definition_digest: action.process_definition_digest,
    source_node: action.source_node,
    repository_binding_digest: action.repository_binding_digest,
    issuance_identity_digest: action.issuance_identity_digest,
    issuance_history_digest: action.issuance_history_digest,
    issuance_content_digest: action.issuance_content_digest,
    payload,
  });
}

export function operationProbe(revision: number, action: ActionView, payload: Record<string, unknown>, operationID: string): OperationProbe {
  return {
    operation_id: operationID,
    expected_revision: revision,
    action_id: action.action_id,
    action_kind: action.action_kind,
    process_id: action.process_id,
    process_definition_digest: action.process_definition_digest,
    source_node: action.source_node,
    repository_binding_digest: action.repository_binding_digest,
    issuance_identity_digest: action.issuance_identity_digest,
    issuance_history_digest: action.issuance_history_digest,
    issuance_content_digest: action.issuance_content_digest,
    payload,
  };
}

export function assessRecovery(taskID: string, operation: OperationProbe) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/recovery/assess`, { operation });
}

export function applyRecovery(taskID: string, operation: OperationProbe, recoveryAction: RecoveryAction) {
  return postJSON(`/api/tasks/${encodeURIComponent(taskID)}/recovery/apply`, { operation, recovery_action: recoveryAction });
}

import { translateCurrent } from "./i18n";
