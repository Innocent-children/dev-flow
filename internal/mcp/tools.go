package mcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"io"
	"strings"
)

type openWire struct {
	Host           domain.Host `json:"host"`
	RepositoryPath string      `json:"repository_path"`
	NewTask        *struct {
		Request                 string                    `json:"request"`
		InitialScope            []string                  `json:"initial_scope"`
		InitialOutOfScope       []string                  `json:"initial_out_of_scope"`
		KnownAcceptanceCriteria []string                  `json:"known_acceptance_criteria"`
		VerificationBudget      domain.VerificationBudget `json:"verification_budget"`
		MethodProfile           domain.MethodProfile      `json:"method_profile"`
	} `json:"new_task"`
}
type readWire struct {
	Host           domain.Host         `json:"host"`
	TaskID         domain.ID           `json:"task_id"`
	OperationProbe *operationProbeWire `json:"operation_probe"`
}
type operationProbeWire struct {
	OperationID             domain.ID         `json:"operation_id"`
	ProcessID               domain.ProcessID  `json:"process_id"`
	ProcessVersion          uint32            `json:"process_version"`
	ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
	SourceCursor            domain.NodeID     `json:"source_cursor"`
	ExpectedRevision        uint64            `json:"expected_revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
}
type applyWire struct {
	RequestID               domain.ID         `json:"request_id"`
	Host                    domain.Host       `json:"host"`
	TaskID                  domain.ID         `json:"task_id"`
	Revision                uint64            `json:"revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	ProcessID               domain.ProcessID  `json:"process_id"`
	ProcessVersion          uint32            `json:"process_version"`
	ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
	SourceCursor            domain.NodeID     `json:"source_cursor"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
	RecoveryApply           json.RawMessage   `json:"recovery_apply"`
}
type cancelWire struct {
	RequestID domain.ID   `json:"request_id"`
	Host      domain.Host `json:"host"`
	TaskID    domain.ID   `json:"task_id"`
	Revision  uint64      `json:"revision"`
	Reason    string      `json:"reason"`
}

func decodeClosed(raw []byte, out any) error {
	if rejectDuplicateMembers(raw) != nil {
		return domain.ErrInvalidArgument
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return domain.ErrInvalidArgument
	}
	var x any
	if err := d.Decode(&x); err != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}
func rejectDuplicateMembers(raw []byte) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	var walk func() error
	walk = func() error {
		token, err := d.Token()
		if err != nil {
			return err
		}
		delim, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		if delim == '{' {
			seen := map[string]bool{}
			for d.More() {
				keyToken, err := d.Token()
				if err != nil {
					return err
				}
				key := keyToken.(string)
				if seen[key] {
					return fmt.Errorf("duplicate %s", key)
				}
				seen[key] = true
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		}
		if delim == '[' {
			for d.More() {
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		}
		return nil
	}
	return walk()
}
func ValidateToolInput(tool string, raw []byte) error {
	switch tool {
	case ToolServerInfo:
		var v struct{}
		return decodeClosed(raw, &v)
	case ToolOpenTask:
		if !hasKeys(raw, "host", "repository_path", "new_task") {
			return domain.ErrInvalidArgument
		}
		var v openWire
		if decodeClosed(raw, &v) != nil || !v.Host.IsValid() || v.RepositoryPath == "" {
			return domain.ErrInvalidArgument
		}
		if v.NewTask != nil {
			intent := domain.TaskIntent{Request: v.NewTask.Request, InitialScope: v.NewTask.InitialScope, InitialOutOfScope: v.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: v.NewTask.KnownAcceptanceCriteria, VerificationBudget: v.NewTask.VerificationBudget, MethodProfile: v.NewTask.MethodProfile}
			if intent.Validate() != nil {
				return domain.ErrInvalidArgument
			}
		}
		return nil
	case ToolGetTask, ToolGetNextAction:
		if !hasKeys(raw, "host", "task_id", "operation_probe") {
			return domain.ErrInvalidArgument
		}
		var v readWire
		if decodeClosed(raw, &v) != nil || !v.Host.IsValid() || !v.TaskID.IsValid() {
			return domain.ErrInvalidArgument
		}
		return nil
	case ToolApplyAction:
		if !hasKeys(raw, "request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_version", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload", "recovery_apply") {
			return domain.ErrInvalidArgument
		}
		var v applyWire
		if decodeClosed(raw, &v) != nil || !v.RequestID.IsValid() || !v.Host.IsValid() || !v.TaskID.IsValid() || v.Revision == 0 || !v.ActionID.IsValid() || !v.ActionKind.IsValidV2() || v.ProcessID != domain.ProcessStandardDevelopment || v.ProcessVersion != 1 || !v.ProcessDefinitionDigest.IsValid() || !v.SourceCursor.IsValid() || !v.RepositoryBindingDigest.IsValid() || len(v.Payload) == 0 || string(v.Payload) == "null" {
			return domain.ErrInvalidArgument
		}
		if _, _, err := workflow.DecodeStandardPayload(v.SourceCursor, v.Payload); err != nil {
			return domain.ErrInvalidArgument
		}
		return nil
	case ToolCancelTask:
		if !hasKeys(raw, "request_id", "host", "task_id", "revision", "reason") {
			return domain.ErrInvalidArgument
		}
		var v cancelWire
		if decodeClosed(raw, &v) != nil || !v.RequestID.IsValid() || !v.Host.IsValid() || !v.TaskID.IsValid() || v.Revision == 0 || strings.TrimSpace(v.Reason) == "" {
			return domain.ErrInvalidArgument
		}
		return nil
	default:
		return domain.ErrInvalidArgument
	}
}
func hasKeys(raw []byte, keys ...string) bool {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	for _, key := range keys {
		if _, ok := value[key]; !ok {
			return false
		}
	}
	return true
}
func toOpen(w openWire, id domain.ID) application.OpenTaskRequest {
	r := application.OpenTaskRequest{RequestID: id, Host: w.Host, RepositoryPath: w.RepositoryPath}
	if w.NewTask != nil {
		r.NewTask = &application.NewTaskInput{Request: w.NewTask.Request, InitialScope: w.NewTask.InitialScope, InitialOutOfScope: w.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: w.NewTask.KnownAcceptanceCriteria, VerificationBudget: w.NewTask.VerificationBudget, MethodProfile: w.NewTask.MethodProfile}
	}
	return r
}
func toProbe(w *operationProbeWire) *application.OperationProbe {
	if w == nil {
		return nil
	}
	return &application.OperationProbe{OperationID: w.OperationID, ProcessID: w.ProcessID, ProcessVersion: w.ProcessVersion, ProcessDefinitionDigest: w.ProcessDefinitionDigest, SourceCursor: w.SourceCursor, ExpectedRevision: w.ExpectedRevision, ActionID: w.ActionID, ActionKind: w.ActionKind, RepositoryBindingDigest: w.RepositoryBindingDigest, Payload: w.Payload}
}
