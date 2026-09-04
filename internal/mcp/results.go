package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/userconfig"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type Envelope struct {
	OK        bool              `json:"ok"`
	RequestID string            `json:"request_id"`
	Tool      string            `json:"tool"`
	Result    any               `json:"result,omitempty"`
	Error     *ErrorResult      `json:"error,omitempty"`
	Recovery  *RecoveryGuidance `json:"recovery,omitempty"`
}
type ErrorResult struct {
	Code    domain.ErrorCode `json:"code"`
	Message string           `json:"message"`
	// Details is the closed field-level contract detail. It is omitted when Core
	// has no safe field detail, which keeps the previous public shape valid.
	Details []domain.ContractViolation `json:"details,omitempty"`
	// Guard is the closed transition-guard detail.
	Guard *domain.GuardFailure `json:"guard,omitempty"`
}
type RecoveryGuidance struct {
	RetrySafe bool   `json:"retry_safe"`
	Action    string `json:"action"`
	Message   string `json:"message"`
	// AllowedPaths lists the exact members a bounded correction may change. It
	// appears only with a proven zero-write failure.
	AllowedPaths []string `json:"allowed_paths,omitempty"`
}

// correctCurrentAction is the only recovery action that permits resubmitting the
// same Action.
const correctCurrentAction = "correct_current_action"

type EncodedResult struct {
	JSON    []byte
	IsError bool
}

var fallbackBytes = mustEncode(Envelope{OK: false, RequestID: "request-unavailable", Tool: ToolServerInfo, Error: &ErrorResult{Code: domain.ErrorInternal, Message: "The Core could not complete the operation."}, Recovery: &RecoveryGuidance{RetrySafe: false, Action: "report_internal_error", Message: "Report the bounded failure and stop this operation."}})

func EncodeSuccess(id, tool string, result any) EncodedResult {
	if !domain.ID(id).IsValid() || !isToolName(tool) {
		return fixedFallback()
	}
	raw, err := encodeEnvelope(Envelope{OK: true, RequestID: id, Tool: tool, Result: result})
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
	message, action, guidance := publicFailure(code)
	if code == domain.ErrorRepositoryDrift && typed != nil && validRepositoryDriftMessage(typed.Message) {
		message = typed.Message
	}
	result := &ErrorResult{Code: code, Message: message}
	guard := publicGuardFailure(code, typed)
	if guard != nil {
		guard.Failures = projectSubmissionViolationPaths(tool, guard.Failures)
		result.Guard = guard
		message = "The transition guard was not satisfied."
		result.Message = message
	}
	result.Details = projectSubmissionViolationPaths(tool, publicViolations(code, typed))
	recoveryResult := &RecoveryGuidance{RetrySafe: false, Action: action, Message: guidance}
	if paths := boundedCorrectionPaths(tool, typed, result); len(paths) != 0 {
		recoveryResult = &RecoveryGuidance{RetrySafe: true, Action: correctCurrentAction, Message: boundedCorrectionMessage, AllowedPaths: paths}
	}
	raw, encodeErr := encodeEnvelope(Envelope{OK: false, RequestID: id, Tool: tool, Error: result, Recovery: recoveryResult})
	if encodeErr != nil || !WithinResultEnvelopeLimit(raw) {
		return fixedFallback()
	}
	return EncodedResult{JSON: raw, IsError: true}
}

func projectSubmissionViolationPaths(tool string, violations []domain.ContractViolation) []domain.ContractViolation {
	if _, ok := submissionKindForTool(tool); !ok {
		return violations
	}
	out := make([]domain.ContractViolation, len(violations))
	for index, violation := range violations {
		out[index] = violation
		out[index].Path = strings.TrimPrefix(violation.Path, "payload.")
	}
	return out
}

// publicViolations keeps only closed, safe field detail for a contract failure.
func publicViolations(code domain.ErrorCode, typed *domain.Error) []domain.ContractViolation {
	if code != domain.ErrorInvalidArgument || typed == nil {
		return nil
	}
	return retainedViolations(typed.Violations)
}

// publicGuardFailure keeps only a closed guard detail whose identity comes from
// the current Process Definition. Repository drift, member format failures and
// unknown work items never reach this shape.
func publicGuardFailure(code domain.ErrorCode, typed *domain.Error) *domain.GuardFailure {
	if code != domain.ErrorTransitionNotAllowed || typed == nil || typed.Guard == nil {
		return nil
	}
	if !workflow.KnownTransitionGuard(typed.Guard.GuardID) {
		return nil
	}
	failures := retainedViolations(typed.Guard.Failures)
	if len(failures) == 0 {
		return nil
	}
	return &domain.GuardFailure{GuardID: typed.Guard.GuardID, Failures: failures}
}
func retainedViolations(violations []domain.ContractViolation) []domain.ContractViolation {
	out := make([]domain.ContractViolation, 0, len(violations))
	for _, violation := range violations {
		if !violation.Rule.IsValid() && !domain.GuardRule(violation.Rule).IsValid() {
			continue
		}
		if !domain.ValidViolationPath(violation.Path) || violation.Message == "" {
			continue
		}
		out = append(out, violation)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// boundedCorrectionMessage states the closed boundary of one correction: only
// the listed members change, the values come from facts the current Action work
// already established, and a second failed submission stops the attempt.
const boundedCorrectionMessage = "Correct only the members listed in allowed_paths, using facts already confirmed in the current Action work, and resubmit through the same submission tool once. Do not re-expand requirements, change more code, or guess a user decision; stop when the resubmission fails."

// boundedCorrectionPaths returns the members one bounded submission correction
// may change for a proven zero-write failure. Every rule in the failure must be
// bounded-correction eligible, so a failure that mixes one ineligible rule
// offers no correction at all.
func boundedCorrectionPaths(tool string, typed *domain.Error, result *ErrorResult) []string {
	if typed == nil || !typed.ZeroWrite {
		return nil
	}
	if typed.Code != domain.ErrorInvalidArgument && typed.Code != domain.ErrorTransitionNotAllowed {
		return nil
	}
	_, submissionTool := submissionKindForTool(tool)
	entries := append([]domain.ContractViolation(nil), result.Details...)
	if result.Guard != nil {
		entries = append(entries, result.Guard.Failures...)
	}
	if len(entries) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(entries))
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !boundedCorrectionRule(entry.Rule, submissionTool) {
			return nil
		}
		if seen[entry.Path] {
			continue
		}
		seen[entry.Path] = true
		paths = append(paths, entry.Path)
	}
	return paths
}

// boundedCorrectionRule decides whether one closed failure rule may be answered
// by one bounded submission correction. A required member missing from a node
// submission is zero-write and its value is the caller's own current fact, so a
// node submission tool may correct it once; the same rule outside a submission
// tool keeps non-retryable guidance.
func boundedCorrectionRule(rule domain.ViolationRule, submissionTool bool) bool {
	if rule == domain.RuleRequiredMemberMissing {
		return submissionTool
	}
	switch rule {
	case domain.RuleNonAutomatedCommandCountZero,
		domain.RuleNonAutomatedFullSuiteFalse,
		domain.RuleUnknownMember,
		domain.RuleCurrentValueRequired,
		domain.RuleCurrentSetRequired,
		domain.RuleAcceptanceSetCurrent:
		return true
	default:
		switch domain.GuardRule(rule) {
		case domain.GuardForwardFindingsEmpty,
			domain.GuardCurrentValueRequired,
			domain.GuardCurrentSetRequired,
			domain.GuardAcceptanceSetCurrent:
			return true
		default:
			return false
		}
	}
}

func validRepositoryDriftMessage(message string) bool {
	const prefix = `Repository "`
	const middle = `" has repository drift: `
	if !strings.HasPrefix(message, prefix) || !strings.HasSuffix(message, ".") {
		return false
	}
	remainder := strings.TrimSuffix(strings.TrimPrefix(message, prefix), ".")
	parts := strings.Split(remainder, middle)
	if len(parts) != 2 {
		return false
	}
	return domain.RepositoryKey(parts[0]).IsValid() && recovery.RepositoryReason(parts[1]).IsValid()
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
	m := map[domain.ErrorCode][3]string{
		domain.ErrorInvalidArgument:              {"The request does not match the closed Core contract.", "none", "Correct the request before submitting it again."},
		domain.ErrorNotGitRepository:             {"The requested path is not a Git repository.", "none", "Choose a valid local Git repository."},
		domain.ErrorTaskNotFound:                 {"The task was not found.", "read_task", "Confirm the retained task identity before continuing."},
		domain.ErrorActiveTaskConflict:           {"The worktree instance already has an active task.", "read_task", "Resume the active task or choose another provisioned worktree."},
		domain.ErrorHostOwnershipConflict:        {"The task belongs to another host.", "use_origin_host", "Resume the task from its origin host."},
		domain.ErrorRevisionConflict:             {"The submitted task revision is stale.", "read_task", "Read the authoritative task before another mutation."},
		domain.ErrorActionStale:                  {"The submitted action identity is stale.", "read_next_action", "Read and use the exact persisted next action."},
		domain.ErrorRepositoryDrift:              {"The repository observation is not permitted for this operation.", "read_next_action", "Read the current workspace blocker or action."},
		domain.ErrorWorkspaceUnavailable:         {"The retained Task worktree instance is unavailable.", "restore_or_abandon", "Restore the original worktree instance or explicitly abandon the Task."},
		domain.ErrorWorkspaceObservationUnstable: {"The Task repository scope changed during observation.", "retry_read", "Wait for repository activity to settle, then read the Task again."},
		domain.ErrorWorkspaceHistoryConflict:     {"The Task worktree history conflicts with its retained state.", "resolve_blocker", "Restore the retained history or resolve the prepared history decision."},
		domain.ErrorWorktreeProvisioningRequired: {"A clean dedicated worktree is required before opening a Task.", "provision_worktree", "Complete Host worktree provisioning and submit its exact origin."},
		domain.ErrorTransitionNotAllowed:         {"The transition is not allowed from the current node.", "read_next_action", "Read the complete current transition set."},
		domain.ErrorProcessUnsupported:           {"The process definition is unsupported.", "repair_storage", "Use storage created by this graph Core."},
		domain.ErrorRecoveryUnavailable:          {"Recovery is unavailable for this operation.", "none", "Do not automatically retry; use only a supported graph recovery route."},
		domain.ErrorVerificationBudgetExceeded:   {"The submitted evidence exceeds the current verification budget.", "read_next_action", "Return to the current TEST Action and submit only a specifically justified verification budget increase before running more automatic checks."},
		domain.ErrorTaskBlocked:                  {"The task is blocked.", "read_next_action", "Read the blocker-resolution action."},
		domain.ErrorTaskTerminal:                 {"The task is terminal.", "read_task", "Read the retained terminal outcome."},
		domain.ErrorSchemaUnsupported:            {"The storage schema is unsupported.", "none", "Stop this operation."},
		domain.ErrorStorageUnavailable:           {"Core storage is unavailable.", "repair_storage", "Restore storage availability before continuing."},
		domain.ErrorInternal:                     {"The Core could not complete the operation.", "report_internal_error", "Report the bounded failure and stop this operation."},
	}
	v, ok := m[code]
	if !ok {
		v = m[domain.ErrorInternal]
	}
	return v[0], v[1], v[2]
}

type ServerInfoResult struct {
	Product            string                   `json:"product"`
	Version            string                   `json:"version"`
	Transport          string                   `json:"transport"`
	Health             string                   `json:"health"`
	SupportedHosts     []string                 `json:"supported_hosts"`
	SupportedProcesses []SupportedProcessResult `json:"supported_processes"`
	MethodProfiles     []domain.MethodProfile   `json:"method_profiles"`
	Tools              []string                 `json:"tools"`
	HostPreferences    userconfig.Preferences   `json:"host_preferences"`
}
type SupportedProcessResult struct {
	ProcessID        domain.ProcessID `json:"process_id"`
	DefinitionDigest domain.Digest    `json:"definition_digest"`
	NewTaskSupported bool             `json:"new_task_supported"`
}

func projectAction(a *domain.ProcessAction) any {
	if a == nil {
		return nil
	}
	tool, _ := submissionToolForActionKind(a.Kind)
	return map[string]any{"task_id": a.TaskID, "revision": a.Revision, "action_id": a.ActionID, "action_kind": a.Kind, "submission_tool": tool, "process_id": a.Process.ID, "process_definition_digest": a.Process.DefinitionDigest, "current_node": a.NodeID, "node_purpose": a.NodeContract.Purpose, "entry_conditions": a.NodeContract.EntryConditions, "completion_conditions": a.NodeContract.CompletionConditions, "allowed_effects": a.AllowedEffects, "required_evidence": a.RequiredEvidence, "method_profile": a.MethodProfile, "method_steps": a.SemanticMethodSteps, "available_transitions": a.AvailableTransitions, "payload_contract": a.PayloadContract, "guidance": a.Guidance, "repository_binding_digest": a.RepositoryBindingDigest, "issuance_identity_digest": a.IssuanceIdentityDigest, "issuance_history_digest": a.IssuanceHistoryDigest, "issuance_content_digest": a.IssuanceContentDigest, "issued_at": a.IssuedAt}
}
func projectTask(t domain.ProcessTask) any {
	var plan any
	var currentBudget any
	if t.TaskPlan != nil {
		plan = t.TaskPlan.VerificationPlan
		if budget, ok := t.CurrentVerificationBudget(); ok {
			currentBudget = budget
		}
	}
	verification := map[string]any{"plan": plan, "current_budget": currentBudget, "usage": t.CurrentVerificationUsage(), "adjustments": t.VerificationBudgetAdjustments}
	result := map[string]any{"task_id": t.TaskID, "origin_host": t.OriginHost, "process_id": t.Process.ID, "process_definition_digest": t.Process.DefinitionDigest, "intent": t.Intent, "current_cursor": t.CurrentNode, "resume_cursor": t.ResumeNode, "primary_repository_key": t.EffectivePrimaryRepositoryKey(), "workspace_origin": t.WorkspaceOrigin, "repository": projectRepository(t.Repository), "baselines": map[string]any{"requirements": t.Requirements, "design": t.Design, "task_plan": t.TaskPlan, "history": t.BaselineHistory}, "implementation": t.Implementation, "test": t.Test, "comprehension": t.Comprehension, "verification": verification, "verification_attempts": t.VerificationAttempts, "file_scope_records": t.FileScopeRecords, "current_changed_paths": t.CurrentChangedPaths, "relocation": t.Relocation, "current_action": projectAction(t.CurrentAction), "blocker": t.Blocker, "last_operation": t.LastOperation, "evidence": t.Evidence, "outcome": t.Outcome, "revision": t.Revision, "created_at": t.CreatedAt, "updated_at": t.UpdatedAt, "completed_at": t.CompletedAt}
	if len(t.AdditionalRepositories) != 0 {
		entries := append([]domain.RepositoryScopeEntry(nil), t.AdditionalRepositories...)
		sort.Slice(entries, func(i, j int) bool { return entries[i].Key < entries[j].Key })
		additional := make([]map[string]any, len(entries))
		for i, entry := range entries {
			additional[i] = map[string]any{"key": entry.Key, "workspace_origin": entry.Origin, "repository": projectRepository(entry.Binding)}
		}
		result["additional_repositories"] = additional
	}
	return result
}
func projectRepository(repository domain.RepositoryBinding) map[string]any {
	return map[string]any{"worktree_instance_digest": repository.WorktreeInstanceDigest, "identity_digest": repository.IdentityDigest, "history_digest": repository.HistoryDigest, "content_digest": repository.ContentDigest, "current_branch": repository.CurrentBranch, "detached": repository.Detached, "current_head": repository.CurrentHead, "head_tree": repository.HeadTree, "history_relation": repository.HistoryRelation, "base_commit_ancestor": repository.BaseCommitAncestor, "changed_entries": repository.ChangedEntries, "task_surface": repository.TaskSurface, "observed_at": repository.ObservedAt, "binding_digest": repository.BindingDigest}
}
func projectNextAction(result application.NextActionResult) any {
	return map[string]any{"task_id": result.TaskID, "process": result.Process, "current_cursor": result.CurrentNode, "revision": result.Revision, "method_profile": result.MethodProfile, "blocker": result.Blocker, "action": projectAction(result.Action), "outcome": result.Outcome, "recovery_assessment": projectRecoveryAssessment(result.RecoveryAssessment)}
}

func projectRecoveryAssessment(assessment *recovery.RecoveryAssessment) any {
	if assessment == nil {
		return nil
	}
	operation := assessment.Operation
	result := map[string]any{
		"classification":               assessment.Classification,
		"operation":                    map[string]any{"operation_id": operation.OperationID, "process_id": operation.Process.ID, "process_definition_digest": operation.Process.DefinitionDigest, "source_cursor": operation.SourceCursor, "expected_revision": operation.ExpectedRevision, "action_id": operation.ActionID, "action_kind": operation.ActionKind, "repository_binding_digest": operation.RepositoryBindingDigest, "issuance_identity_digest": operation.IssuanceIdentityDigest, "issuance_history_digest": operation.IssuanceHistoryDigest, "issuance_content_digest": operation.IssuanceContentDigest},
		"task_revision":                assessment.TaskRevision,
		"current_action_id":            assessment.CurrentActionID,
		"issuance_binding_digest":      assessment.IssuanceBindingDigest,
		"authoritative_binding_digest": assessment.AuthoritativeBindingDigest,
		"observed_binding_digest":      assessment.ObservedBindingDigest,
		"repository_relation":          assessment.RepositoryRelation,
		"last_operation_relation":      assessment.LastOperationRelation,
		"operation_evidence":           assessment.OperationEvidence,
		"operation_payload_digest":     assessment.OperationPayloadDigest,
		"committed_proof":              assessment.CommittedProof,
		"action_retry_safe":            assessment.ActionRetrySafe,
		"next_advice":                  assessment.NextAdvice,
		"unblock_condition":            assessment.UnblockCondition,
		"observed_at":                  assessment.ObservedAt,
	}
	if len(assessment.Repositories) != 0 {
		repositories := append([]recovery.RepositoryFact(nil), assessment.Repositories...)
		sort.Slice(repositories, func(i, j int) bool { return repositories[i].RepositoryKey < repositories[j].RepositoryKey })
		projected := make([]map[string]any, len(repositories))
		for i, repository := range repositories {
			projected[i] = map[string]any{"key": repository.RepositoryKey, "relation": repository.Relation, "reason": repository.Reason}
		}
		result["repositories"] = projected
	}
	return result
}

func WithinResultEnvelopeLimit(raw []byte) bool { return len(raw) <= domain.MaxResultEnvelopeBytes }
