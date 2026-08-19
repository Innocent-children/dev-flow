package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

const resultSchemaVersion = 2

type Envelope struct {
	SchemaVersion int               `json:"schema_version"`
	OK            bool              `json:"ok"`
	RequestID     string            `json:"request_id"`
	Tool          string            `json:"tool"`
	Result        any               `json:"result,omitempty"`
	Error         *ErrorResult      `json:"error,omitempty"`
	Recovery      *RecoveryGuidance `json:"recovery,omitempty"`
}
type ErrorResult struct {
	Code    domain.ErrorCode `json:"code"`
	Message string           `json:"message"`
}
type RecoveryGuidance struct {
	RetrySafe bool   `json:"retry_safe"`
	Action    string `json:"action"`
	Message   string `json:"message"`
}
type EncodedResult struct {
	JSON    []byte
	IsError bool
}

var fallbackBytes = mustEncode(Envelope{SchemaVersion: 2, OK: false, RequestID: "request-unavailable", Tool: ToolServerInfo, Error: &ErrorResult{Code: domain.ErrorInternal, Message: "The Core could not complete the operation."}, Recovery: &RecoveryGuidance{RetrySafe: false, Action: "report_internal_error", Message: "Report the bounded failure and stop this operation."}})

func EncodeSuccess(id, tool string, result any) EncodedResult {
	if !domain.ID(id).IsValid() || !isToolName(tool) {
		return fixedFallback()
	}
	raw, err := encodeEnvelope(Envelope{SchemaVersion: 2, OK: true, RequestID: id, Tool: tool, Result: result})
	if err != nil || !WithinResultEnvelopeLimit(raw) {
		return fixedFallback()
	}
	return EncodedResult{JSON: raw}
}
func EncodeError(id, tool string, err error) EncodedResult {
	if !domain.ID(id).IsValid() || !isToolName(tool) {
		return fixedFallback()
	}
	code := domain.ErrorInternal
	var typed *domain.Error
	if errors.As(err, &typed) && typed.Code.IsValid() {
		code = typed.Code
	}
	message, action, recovery := publicFailure(code)
	raw, encodeErr := encodeEnvelope(Envelope{SchemaVersion: 2, OK: false, RequestID: id, Tool: tool, Error: &ErrorResult{Code: code, Message: message}, Recovery: &RecoveryGuidance{RetrySafe: false, Action: action, Message: recovery}})
	if encodeErr != nil || !WithinResultEnvelopeLimit(raw) {
		return fixedFallback()
	}
	return EncodedResult{JSON: raw, IsError: true}
}
func fixedFallback() EncodedResult {
	return EncodedResult{JSON: append([]byte(nil), fallbackBytes...), IsError: true}
}
func encodeEnvelope(v Envelope) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(b.Bytes(), []byte("\n")), nil
}
func mustEncode(v Envelope) []byte {
	raw, err := encodeEnvelope(v)
	if err != nil || len(raw) > domain.MaxResultEnvelopeBytes {
		panic("invalid fixed result envelope")
	}
	return raw
}
func publicFailure(code domain.ErrorCode) (string, string, string) {
	m := map[domain.ErrorCode][3]string{domain.ErrorInvalidArgument: {"The request does not match the closed Core contract.", "none", "Correct the request before submitting it again."}, domain.ErrorNotGitRepository: {"The requested path is not a Git repository.", "none", "Choose a valid local Git repository."}, domain.ErrorTaskNotFound: {"The task was not found.", "read_task", "Confirm the retained task identity before continuing."}, domain.ErrorActiveTaskConflict: {"The repository already has an incompatible active task.", "cancel_or_finish_active_task", "Finish or cancel the active task before opening another task."}, domain.ErrorHostOwnershipConflict: {"The task belongs to another host.", "use_origin_host", "Resume the task from its origin host."}, domain.ErrorRevisionConflict: {"The submitted task revision is stale.", "read_task", "Read the authoritative task before another mutation."}, domain.ErrorActionStale: {"The submitted action identity is stale.", "read_next_action", "Read and use the exact persisted next action."}, domain.ErrorRepositoryDrift: {"The repository binding is not permitted for this operation.", "resolve_repository_drift", "Restore the required repository reality before continuing."}, domain.ErrorTransitionNotAllowed: {"The transition is not allowed from the current node.", "read_next_action", "Read the complete current transition set."}, domain.ErrorProcessUnsupported: {"The process definition is unsupported.", "repair_storage", "Use storage created by this graph Core."}, domain.ErrorVerificationBudgetExceeded: {"The submitted evidence exceeds the verification budget.", "read_next_action", "Remain within the current evidence budget."}, domain.ErrorTaskBlocked: {"The task is blocked.", "read_next_action", "Read the blocker-resolution action."}, domain.ErrorTaskTerminal: {"The task is terminal.", "read_task", "Read the retained terminal outcome."}, domain.ErrorSchemaUnsupported: {"Pre-graph task data is unsupported by this Core.", "repair_storage", "Choose a fresh data directory or manage the old directory outside Core."}, domain.ErrorStorageUnavailable: {"Core storage is unavailable.", "repair_storage", "Restore storage availability before continuing."}, domain.ErrorInternal: {"The Core could not complete the operation.", "report_internal_error", "Report the bounded failure and stop this operation."}}
	v, ok := m[code]
	if !ok {
		v = m[domain.ErrorInternal]
	}
	return v[0], v[1], v[2]
}

type ServerInfoResult struct {
	Product            string                    `json:"product"`
	Version            string                    `json:"version"`
	SchemaVersion      int                       `json:"schema_version"`
	CoreLimitsVersion  string                    `json:"core_limits_version"`
	Transport          string                    `json:"transport"`
	Health             string                    `json:"health"`
	SupportedHosts     []string                  `json:"supported_hosts"`
	SupportedProcesses []domain.ProcessReference `json:"supported_processes"`
	MethodProfiles     []domain.MethodProfile    `json:"method_profiles"`
	Tools              []string                  `json:"tools"`
}

func projectAction(a *domain.ProcessActionV2) any {
	if a == nil {
		return nil
	}
	return map[string]any{"task_id": a.TaskID, "revision": a.Revision, "action_id": a.ActionID, "action_kind": a.Kind, "process_id": a.Process.ID, "process_version": a.Process.Version, "process_definition_digest": a.Process.DefinitionDigest, "current_node": a.NodeID, "node_purpose": a.NodeContract.Purpose, "entry_conditions": a.NodeContract.EntryConditions, "completion_conditions": a.NodeContract.CompletionConditions, "allowed_effects": a.AllowedEffects, "required_evidence": a.RequiredEvidence, "method_steps": a.SemanticMethodSteps, "available_transitions": a.AvailableTransitions, "payload_contract": a.PayloadContract, "guidance": a.Guidance, "repository_binding_digest": a.RepositoryBindingDigest, "issued_at": a.IssuedAt}
}
func projectTask(t domain.ProcessTask) any {
	return map[string]any{"task_id": t.TaskID, "origin_host": t.OriginHost, "snapshot_version": 2, "process_id": t.Process.ID, "process_version": t.Process.Version, "process_definition_digest": t.Process.DefinitionDigest, "intent": t.Intent, "current_cursor": t.CurrentNode, "resume_cursor": t.ResumeNode, "repository": map[string]any{"repository_identity": t.Repository.RepositoryIdentity, "branch": t.Repository.Branch, "detached": t.Repository.Detached, "head": t.Repository.Head, "unborn": t.Repository.Unborn, "worktree_fingerprint": t.Repository.WorktreeFingerprint, "observed_at": t.Repository.ObservedAt, "binding_digest": t.Repository.BindingDigest}, "baselines": map[string]any{"requirements": t.Requirements, "design": t.Design, "task_plan": t.TaskPlan, "history": t.BaselineHistory}, "implementation": t.Implementation, "test": t.Test, "comprehension": t.Comprehension, "current_action": projectAction(t.CurrentAction), "blocker": t.Blocker, "last_operation": t.LastOperation, "evidence": t.Evidence, "outcome": t.Outcome, "revision": t.Revision, "created_at": t.CreatedAt, "updated_at": t.UpdatedAt, "completed_at": t.CompletedAt}
}

func WithinResultEnvelopeLimit(raw []byte) bool { return len(raw) <= domain.MaxResultEnvelopeBytes }
