package mcp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"strings"
)

type RequestIDGenerator func() (domain.ID, error)
type ServerOptions struct {
	Diagnostics  *Diagnostics
	NewRequestID RequestIDGenerator
	Instructions string
}
type Server struct {
	application  *application.Service
	version      string
	sdk          *sdk.Server
	newRequestID RequestIDGenerator
}

func NewServer(service *application.Service, version string, options *ServerOptions) (*Server, error) {
	if service == nil || strings.TrimSpace(version) != version || version == "" {
		return nil, domain.ErrInvalidArgument
	}
	newID := randomRequestID
	if options != nil && options.NewRequestID != nil {
		newID = options.NewRequestID
	}
	s := &Server{application: service, version: version, newRequestID: newID}
	s.sdk = sdk.NewServer(&sdk.Implementation{Name: "dev-flow", Title: "Dev Flow Core", Description: "Local STDIO Core Contract 0.2", Version: version}, &sdk.ServerOptions{})
	for _, d := range catalog {
		d := d
		destructive, openWorld := d.Annotations.Destructive, d.Annotations.OpenWorld
		s.sdk.AddTool(&sdk.Tool{Name: d.Name, Description: d.Description, InputSchema: json.RawMessage(d.InputSchema), Annotations: &sdk.ToolAnnotations{ReadOnlyHint: d.Annotations.ReadOnly, IdempotentHint: d.Annotations.Idempotent, DestructiveHint: &destructive, OpenWorldHint: &openWorld}}, func(ctx context.Context, r *sdk.CallToolRequest) (*sdk.CallToolResult, error) {
			raw := json.RawMessage(`{}`)
			if r != nil && r.Params != nil {
				raw = r.Params.Arguments
			}
			id, err := s.newRequestID()
			if err != nil || !id.IsValid() {
				encoded := fixedFallback()
				return &sdk.CallToolResult{Content: []sdk.Content{&sdk.TextContent{Text: string(encoded.JSON)}}, IsError: true}, nil
			}
			encoded := s.dispatch(ctx, d.Name, id, raw)
			return &sdk.CallToolResult{Content: []sdk.Content{&sdk.TextContent{Text: string(encoded.JSON)}}, IsError: encoded.IsError}, nil
		})
	}
	return s, nil
}
func (s *Server) Run(ctx context.Context, t sdk.Transport) error { return s.sdk.Run(ctx, t) }
func (s *Server) dispatch(ctx context.Context, tool string, id domain.ID, raw []byte) EncodedResult {
	if err := ValidateToolInput(tool, raw); err != nil {
		return EncodeError(string(id), tool, err)
	}
	switch tool {
	case ToolServerInfo:
		d := workflow.StandardProcess()
		return EncodeSuccess(string(id), tool, ServerInfoResult{Product: "dev-flow", Version: s.version, SchemaVersion: 2, CoreLimitsVersion: domain.CoreLimitsVersion, Transport: "stdio", Health: "ready", SupportedProcesses: []domain.ProcessReference{d.Reference}, SupportedHosts: []string{"codex", "deepseek"}, MethodProfiles: []domain.MethodProfile{domain.MethodPlain, domain.MethodSpecKit, domain.MethodOpenSpec}, Tools: ToolNames()})
	case ToolOpenTask:
		var w openWire
		_ = decodeClosed(raw, &w)
		r, err := s.application.OpenTask(ctx, toOpen(w, id))
		if err != nil {
			return EncodeError(string(id), tool, err)
		}
		return EncodeSuccess(string(id), tool, map[string]any{"created": r.Created, "task": projectTask(r.Task), "recovery_assessment": nil})
	case ToolGetTask:
		var w readWire
		_ = decodeClosed(raw, &w)
		r, err := s.application.GetTask(ctx, application.GetTaskRequest{Host: w.Host, TaskID: w.TaskID, OperationProbe: toProbe(w.OperationProbe)})
		if err != nil {
			return EncodeError(string(id), tool, err)
		}
		return EncodeSuccess(string(id), tool, map[string]any{"task": projectTask(r.Task), "recovery_assessment": nil})
	case ToolGetNextAction:
		var w readWire
		_ = decodeClosed(raw, &w)
		r, err := s.application.GetNextAction(ctx, application.GetNextActionRequest{Host: w.Host, TaskID: w.TaskID, OperationProbe: toProbe(w.OperationProbe)})
		if err != nil {
			return EncodeError(string(id), tool, err)
		}
		return EncodeSuccess(string(id), tool, map[string]any{"task_id": r.TaskID, "snapshot_version": 2, "process": r.Process, "current_cursor": r.CurrentNode, "revision": r.Revision, "method_profile": func() domain.MethodProfile {
			if r.Action != nil {
				return r.Action.MethodProfile
			}
			return ""
		}(), "blocker": nil, "action": projectAction(r.Action), "outcome": r.Outcome, "recovery_assessment": nil})
	case ToolApplyAction:
		var w applyWire
		_ = decodeClosed(raw, &w)
		r, err := s.application.ApplyAction(ctx, application.ApplyActionRequest{RequestID: w.RequestID, Host: w.Host, TaskID: w.TaskID, ExpectedRevision: w.Revision, ActionID: w.ActionID, ActionKind: w.ActionKind, ProcessID: w.ProcessID, ProcessVersion: w.ProcessVersion, ProcessDefinitionDigest: w.ProcessDefinitionDigest, SourceCursor: w.SourceCursor, RepositoryBindingDigest: w.RepositoryBindingDigest, Payload: w.Payload})
		if err != nil {
			return EncodeError(string(id), tool, err)
		}
		return EncodeSuccess(string(id), tool, projectTask(r.Task))
	case ToolCancelTask:
		var w cancelWire
		_ = decodeClosed(raw, &w)
		r, err := s.application.CancelTask(ctx, application.CancelTaskRequest{RequestID: w.RequestID, Host: w.Host, TaskID: w.TaskID, ExpectedRevision: w.Revision, Reason: w.Reason})
		if err != nil {
			return EncodeError(string(id), tool, err)
		}
		return EncodeSuccess(string(id), tool, projectTask(r.Task))
	default:
		return EncodeError(string(id), tool, domain.ErrInvalidArgument)
	}
}
func randomRequestID() (domain.ID, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return domain.ID("request-" + hex.EncodeToString(b[:])), nil
}
