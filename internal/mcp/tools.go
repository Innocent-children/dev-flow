package mcp

import (
	"bytes"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"io"
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
	Host   domain.Host `json:"host"`
	TaskID domain.ID   `json:"task_id"`
}
type applyWire struct {
	RequestID               domain.ID         `json:"request_id"`
	Host                    domain.Host       `json:"host"`
	TaskID                  domain.ID         `json:"task_id"`
	Revision                uint64            `json:"revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
}
type cancelWire struct {
	Host     domain.Host `json:"host"`
	TaskID   domain.ID   `json:"task_id"`
	Revision uint64      `json:"revision"`
	Reason   string      `json:"reason"`
}

func decodeClosed(raw []byte, out any) error {
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
func ValidateToolInput(tool string, raw []byte) error {
	switch tool {
	case ToolServerInfo:
		var v struct{}
		return decodeClosed(raw, &v)
	case ToolOpenTask:
		var v openWire
		return decodeClosed(raw, &v)
	case ToolGetTask, ToolGetNextAction:
		var v readWire
		return decodeClosed(raw, &v)
	case ToolApplyAction:
		var v applyWire
		return decodeClosed(raw, &v)
	case ToolCancelTask:
		var v cancelWire
		return decodeClosed(raw, &v)
	default:
		return domain.ErrInvalidArgument
	}
}
func toOpen(w openWire, id domain.ID) application.OpenTaskRequest {
	r := application.OpenTaskRequest{RequestID: id, Host: w.Host, RepositoryPath: w.RepositoryPath}
	if w.NewTask != nil {
		r.NewTask = &application.NewTaskInput{Request: w.NewTask.Request, InitialScope: w.NewTask.InitialScope, InitialOutOfScope: w.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: w.NewTask.KnownAcceptanceCriteria, VerificationBudget: w.NewTask.VerificationBudget, MethodProfile: w.NewTask.MethodProfile}
	}
	return r
}
