package mcp

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

const resultSchemaVersion = 2

type Envelope struct {
	SchemaVersion int          `json:"schema_version"`
	RequestID     string       `json:"request_id"`
	Tool          string       `json:"tool"`
	OK            bool         `json:"ok"`
	Result        any          `json:"result,omitempty"`
	Error         *ErrorResult `json:"error,omitempty"`
}
type ErrorResult struct {
	Code    domain.ErrorCode `json:"code"`
	Message string           `json:"message"`
}
type EncodedResult struct {
	JSON    []byte
	IsError bool
}

func EncodeSuccess(id, tool string, result any) EncodedResult {
	raw, _ := json.Marshal(Envelope{SchemaVersion: 2, RequestID: id, Tool: tool, OK: true, Result: result})
	return EncodedResult{JSON: raw}
}
func EncodeError(id, tool string, err error) EncodedResult {
	code := domain.ErrorInternal
	if e, ok := err.(*domain.Error); ok {
		code = e.Code
	}
	raw, _ := json.Marshal(Envelope{SchemaVersion: 2, RequestID: id, Tool: tool, OK: false, Error: &ErrorResult{Code: code, Message: err.Error()}})
	return EncodedResult{JSON: raw, IsError: true}
}

type ServerInfoResult struct {
	Product, Version, Transport, Health string
	SchemaVersion                       int                       `json:"schema_version"`
	SupportedProcesses                  []domain.ProcessReference `json:"supported_processes"`
	SupportedHosts, Tools               []string
	MethodProfiles                      []domain.MethodProfile `json:"method_profiles"`
}

func projectTask(task domain.ProcessTask) any {
	return map[string]any{"task_id": task.TaskID, "origin_host": task.OriginHost, "intent": task.Intent, "process": task.Process, "current_node": task.CurrentNode, "revision": task.Revision, "repository_binding_digest": task.Repository.BindingDigest, "requirements": task.Requirements, "design": task.Design, "task_plan": task.TaskPlan, "current_action": task.CurrentAction, "outcome": task.Outcome, "created_at": task.CreatedAt, "updated_at": task.UpdatedAt}
}
func WithinResultEnvelopeLimit(raw []byte) bool { return len(raw) <= domain.MaxResultEnvelopeBytes }
