package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

const resultSchemaVersion = 1

const fixedInternalErrorFallbackJSON = `{"schema_version":1,"ok":false,"request_id":"request-invalid","tool":"dev_flow_server_info","error":{"code":"INTERNAL_ERROR","message":"The Core could not return a result."},"recovery":{"retry_safe":false,"action":"report_internal_error","message":"Report the bounded failure and stop this operation."}}`

// EncodedResult is the complete compact JSON value returned by one tool call.
// JSON is already size-checked and safe to place in both MCP structured and
// text content.
type EncodedResult struct {
	JSON    []byte
	IsError bool
}

type successEnvelope[T any] struct {
	SchemaVersion int    `json:"schema_version"`
	OK            bool   `json:"ok"`
	RequestID     string `json:"request_id"`
	Tool          string `json:"tool"`
	Result        T      `json:"result"`
}

type errorEnvelope struct {
	SchemaVersion int              `json:"schema_version"`
	OK            bool             `json:"ok"`
	RequestID     string           `json:"request_id"`
	Tool          string           `json:"tool"`
	Error         ErrorResult      `json:"error"`
	Recovery      RecoveryGuidance `json:"recovery"`
}

// ErrorResult is the closed public failure projection. Details, when present,
// are adapter-owned fixed values rather than raw dependency errors.
type ErrorResult struct {
	Code    domain.ErrorCode `json:"code"`
	Message string           `json:"message"`
	Details *ErrorDetails    `json:"details,omitempty"`
}

type ErrorDetails struct {
	Reason string `json:"reason"`
}

// RecoveryGuidance is error-only retry guidance. It is intentionally distinct
// from recovery.RecoveryAssessment in successful read results.
type RecoveryGuidance struct {
	RetrySafe bool   `json:"retry_safe"`
	Action    string `json:"action"`
	Message   string `json:"message"`
}

type ContractProjection struct {
	Goal               string                    `json:"goal"`
	Scope              []string                  `json:"scope"`
	OutOfScope         []string                  `json:"out_of_scope"`
	AcceptanceCriteria []string                  `json:"acceptance_criteria"`
	VerificationBudget domain.VerificationBudget `json:"verification_budget"`
}

type TaskProjection struct {
	TaskID        domain.ID                `json:"task_id"`
	OriginHost    domain.Host              `json:"origin_host"`
	Contract      ContractProjection       `json:"contract"`
	Repository    domain.RepositoryBinding `json:"repository"`
	Phase         domain.Phase             `json:"phase"`
	ResumePhase   *domain.Phase            `json:"resume_phase"`
	CurrentAction *domain.Action           `json:"current_action"`
	Blocker       *domain.Blocker          `json:"blocker"`
	LastOperation *domain.LastOperation    `json:"last_operation"`
	Evidence      []domain.EvidenceSummary `json:"evidence"`
	Outcome       *domain.Outcome          `json:"outcome"`
	Revision      uint64                   `json:"revision"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
	CompletedAt   *time.Time               `json:"completed_at"`
}

type ServerInfoResult struct {
	Product        string   `json:"product"`
	Version        string   `json:"version"`
	SchemaVersion  int      `json:"schema_version"`
	Transport      string   `json:"transport"`
	Health         string   `json:"health"`
	SupportedHosts []string `json:"supported_hosts"`
	Tools          []string `json:"tools"`
}

type OpenTaskToolResult struct {
	Created bool           `json:"created"`
	Task    TaskProjection `json:"task"`
}

type GetTaskToolResult struct {
	Task               TaskProjection               `json:"task"`
	RecoveryAssessment *recovery.RecoveryAssessment `json:"recovery_assessment"`
}

type NextActionToolResult struct {
	TaskID             domain.ID                    `json:"task_id"`
	Phase              domain.Phase                 `json:"phase"`
	Revision           uint64                       `json:"revision"`
	Action             *domain.Action               `json:"action"`
	Blocker            *domain.Blocker              `json:"blocker"`
	Outcome            *domain.Outcome              `json:"outcome"`
	RecoveryAssessment *recovery.RecoveryAssessment `json:"recovery_assessment"`
}

type ApplyActionToolResult struct {
	Task                    TaskProjection `json:"task"`
	RepositoryClaimReleased bool           `json:"repository_claim_released"`
}

type CancelTaskToolResult struct {
	Task                    TaskProjection `json:"task"`
	RepositoryClaimReleased bool           `json:"repository_claim_released"`
}

// EncodeSuccess produces the one success envelope and replaces an oversized or
// unencodable result with a small, non-recursive INTERNAL_ERROR envelope.
func EncodeSuccess[T any](requestID, tool string, result T) EncodedResult {
	requestID, tool = safeEnvelopeIdentity(requestID, tool)
	encoded, err := encodeCompact(successEnvelope[T]{
		SchemaVersion: resultSchemaVersion,
		OK:            true,
		RequestID:     requestID,
		Tool:          tool,
		Result:        result,
	})
	if err != nil {
		return fixedInternalError(requestID, tool, "result_encoding_failed")
	}
	if !WithinResultEnvelopeLimit(encoded) {
		return fixedInternalError(requestID, tool, "result_size_exceeded")
	}
	return EncodedResult{JSON: encoded}
}

// EncodeError maps Domain/Application failures onto a fixed, redacted public
// contract. Unexpected dependency text is never echoed.
func EncodeError(requestID, tool string, err error) EncodedResult {
	requestID, tool = safeEnvelopeIdentity(requestID, tool)
	code := domain.ErrorInternal
	var domainError *domain.Error
	if errors.As(err, &domainError) && domainError != nil && domainError.Code.IsValid() {
		code = domainError.Code
	}
	failure, guidance := publicFailure(code)
	encoded, encodeErr := encodeCompact(errorEnvelope{
		SchemaVersion: resultSchemaVersion,
		OK:            false,
		RequestID:     requestID,
		Tool:          tool,
		Error:         failure,
		Recovery:      guidance,
	})
	if encodeErr != nil || !WithinResultEnvelopeLimit(encoded) {
		return fixedInternalError(requestID, tool, "error_encoding_failed")
	}
	return EncodedResult{JSON: encoded, IsError: true}
}

func WithinResultEnvelopeLimit(encoded []byte) bool {
	return len(encoded) <= domain.MaxResultEnvelopeBytes
}

func projectTask(task domain.Task) TaskProjection {
	contract := task.Contract
	return TaskProjection{
		TaskID:     task.TaskID,
		OriginHost: task.OriginHost,
		Contract: ContractProjection{
			Goal:               contract.Goal(),
			Scope:              nonNilSlice(contract.Scope()),
			OutOfScope:         nonNilSlice(contract.OutOfScope()),
			AcceptanceCriteria: nonNilSlice(contract.AcceptanceCriteria()),
			VerificationBudget: contract.VerificationBudget(),
		},
		Repository:    task.Repository,
		Phase:         task.Phase,
		ResumePhase:   task.ResumePhase,
		CurrentAction: task.CurrentAction,
		Blocker:       task.Blocker,
		LastOperation: task.LastOperation,
		Evidence:      nonNilSlice(task.Evidence),
		Outcome:       task.Outcome,
		Revision:      task.Revision,
		CreatedAt:     task.CreatedAt,
		UpdatedAt:     task.UpdatedAt,
		CompletedAt:   task.CompletedAt,
	}
}

func fixedInternalError(requestID, tool, reason string) EncodedResult {
	failure, guidance := publicFailure(domain.ErrorInternal)
	failure.Details = &ErrorDetails{Reason: reason}
	encoded, err := encodeCompact(errorEnvelope{
		SchemaVersion: resultSchemaVersion,
		OK:            false,
		RequestID:     requestID,
		Tool:          tool,
		Error:         failure,
		Recovery:      guidance,
	})
	if err != nil || !WithinResultEnvelopeLimit(encoded) {
		return fixedInternalErrorFallback()
	}
	return EncodedResult{JSON: encoded, IsError: true}
}

func fixedInternalErrorFallback() EncodedResult {
	return EncodedResult{JSON: []byte(fixedInternalErrorFallbackJSON), IsError: true}
}

func safeEnvelopeIdentity(requestID, tool string) (string, string) {
	if !domain.ID(requestID).IsValid() {
		requestID = "request-invalid"
	}
	if !isToolName(tool) {
		tool = ToolServerInfo
	}
	return requestID, tool
}

func encodeCompact(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte{'\n'}), nil
}

func publicFailure(code domain.ErrorCode) (ErrorResult, RecoveryGuidance) {
	type publicContract struct {
		message         string
		recoveryAction  string
		recoveryMessage string
	}
	contracts := map[domain.ErrorCode]publicContract{
		domain.ErrorInvalidArgument:            {"The request does not match the closed Core contract.", "none", "Correct the request before submitting it again."},
		domain.ErrorNotGitRepository:           {"The requested path is not a Git repository.", "none", "Choose a valid local Git repository."},
		domain.ErrorTaskNotFound:               {"The task was not found.", "read_task", "Confirm the retained task identity before continuing."},
		domain.ErrorActiveTaskConflict:         {"The repository already has an incompatible active task.", "cancel_or_finish_active_task", "Finish or cancel the active task before opening another contract."},
		domain.ErrorHostOwnershipConflict:      {"The task belongs to another host.", "use_origin_host", "Resume the task from its origin host."},
		domain.ErrorRevisionConflict:           {"The submitted task revision is stale.", "read_task", "Read the authoritative task before another mutation."},
		domain.ErrorActionStale:                {"The submitted action identity is stale.", "read_next_action", "Read and use the exact persisted next action."},
		domain.ErrorRepositoryDrift:            {"The repository binding is not permitted for this operation.", "resolve_repository_drift", "Restore the required repository reality before continuing."},
		domain.ErrorVerificationBudgetExceeded: {"The submitted evidence exceeds the verification budget.", "read_next_action", "Read the current action and remain within its evidence budget."},
		domain.ErrorTaskBlocked:                {"The task is blocked.", "read_next_action", "Read the persisted blocker-resolution action."},
		domain.ErrorTaskTerminal:               {"The task is terminal.", "read_task", "Read the retained terminal outcome."},
		domain.ErrorSchemaUnsupported:          {"The storage schema is unsupported.", "repair_storage", "Use compatible Core storage before continuing."},
		domain.ErrorStorageUnavailable:         {"Core storage is unavailable.", "repair_storage", "Restore storage availability before continuing."},
		domain.ErrorInternal:                   {"The Core could not complete the operation.", "report_internal_error", "Report the bounded failure and stop this operation."},
	}
	contract, exists := contracts[code]
	if !exists {
		code = domain.ErrorInternal
		contract = contracts[code]
	}
	return ErrorResult{Code: code, Message: contract.message}, RecoveryGuidance{
		RetrySafe: false,
		Action:    contract.recoveryAction,
		Message:   contract.recoveryMessage,
	}
}

func nonNilSlice[T any](values []T) []T {
	if values == nil {
		return []T{}
	}
	return values
}
