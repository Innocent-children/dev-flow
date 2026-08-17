package mcp

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

type RequestIDGenerator func() (domain.ID, error)

type ServerOptions struct {
	Diagnostics  *Diagnostics
	NewRequestID RequestIDGenerator
	Instructions string
}

// Server is the thin local MCP adapter. The official SDK owns protocol and
// transport lifecycle; Application remains the only task operation surface.
type Server struct {
	application  *application.Service
	version      string
	diagnostics  *Diagnostics
	newRequestID RequestIDGenerator
	sdk          *sdkmcp.Server
}

func NewServer(service *application.Service, version string, options *ServerOptions) (*Server, error) {
	if service == nil || strings.TrimSpace(version) == "" || version != strings.TrimSpace(version) {
		return nil, domain.ErrInvalidArgument
	}
	var configured ServerOptions
	if options != nil {
		configured = *options
	}
	if configured.Diagnostics == nil {
		configured.Diagnostics = NewDiagnostics(nil)
	}
	if configured.NewRequestID == nil {
		configured.NewRequestID = randomRequestID
	}
	instructions := configured.Instructions
	if instructions == "" {
		instructions = "Use only the six governed Dev Flow Core tools. Tool annotations are descriptive and grant no operating-system authority."
	}
	server := &Server{
		application:  service,
		version:      version,
		diagnostics:  configured.Diagnostics,
		newRequestID: configured.NewRequestID,
	}
	server.sdk = sdkmcp.NewServer(&sdkmcp.Implementation{
		Name:        "dev-flow",
		Title:       "Dev Flow Core",
		Description: "Local STDIO Core Contract 0.1",
		Version:     version,
	}, &sdkmcp.ServerOptions{
		Capabilities: &sdkmcp.ServerCapabilities{},
		Instructions: instructions,
	})
	for _, definition := range catalog {
		definition := definition
		server.sdk.AddTool(sdkTool(definition, configured.Instructions), func(ctx context.Context, request *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
			return server.handle(ctx, definition.Name, request), nil
		})
	}
	return server, nil
}

func (server *Server) Run(ctx context.Context, transport sdkmcp.Transport) error {
	if server == nil || server.sdk == nil || transport == nil {
		return domain.ErrInvalidArgument
	}
	return server.sdk.Run(ctx, transport)
}

func (server *Server) handle(ctx context.Context, tool string, request *sdkmcp.CallToolRequest) *sdkmcp.CallToolResult {
	requestID, idErr := server.newRequestID()
	if idErr != nil || !requestID.IsValid() {
		requestID = "request-unavailable"
		encoded := fixedInternalError(string(requestID), tool, "request_id_generation_failed")
		server.diagnostics.failed(string(requestID), tool, domain.ErrorInternal)
		return callToolResult(encoded)
	}
	raw := json.RawMessage(nil)
	if request != nil && request.Params != nil {
		raw = request.Params.Arguments
	}
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}

	encoded := server.dispatch(ctx, tool, requestID, raw)
	if encoded.IsError {
		server.diagnostics.failed(string(resultRequestID(encoded, requestID)), tool, resultErrorCode(encoded))
	} else {
		server.diagnostics.completed(string(resultRequestID(encoded, requestID)), tool)
	}
	return callToolResult(encoded)
}

func (server *Server) dispatch(ctx context.Context, tool string, requestID domain.ID, raw json.RawMessage) EncodedResult {
	switch tool {
	case ToolServerInfo:
		if err := decodeServerInfoInput(raw); err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, ServerInfoResult{
			Product:        "dev-flow",
			Version:        server.version,
			SchemaVersion:  resultSchemaVersion,
			Transport:      "stdio",
			Health:         "ready",
			SupportedHosts: []string{string(domain.HostCodex), string(domain.HostDeepSeek)},
			Tools:          ToolNames(),
		})
	case ToolOpenTask:
		input, err := decodeOpenTaskInput(raw, requestID)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		result, err := server.application.OpenTask(ctx, input)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, OpenTaskToolResult{
			Created: result.Created,
			Task:    projectTask(result.Task),
		})
	case ToolGetTask:
		wire, err := decodeReadTaskInput(raw)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		host, taskID, probe, err := convertReadTaskInput(wire)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		result, err := server.application.GetTask(ctx, application.GetTaskRequest{
			Host: host, TaskID: taskID, OperationProbe: probe,
		})
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, GetTaskToolResult{
			Task: projectTask(result.Task), RecoveryAssessment: result.RecoveryAssessment,
		})
	case ToolGetNextAction:
		wire, err := decodeReadTaskInput(raw)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		host, taskID, probe, err := convertReadTaskInput(wire)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		result, err := server.application.GetNextAction(ctx, application.GetNextActionRequest{
			Host: host, TaskID: taskID, OperationProbe: probe,
		})
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, NextActionToolResult{
			TaskID: result.TaskID, Phase: result.Phase, Revision: result.Revision,
			Action: result.Action, Blocker: result.Blocker, Outcome: result.Outcome,
			RecoveryAssessment: result.RecoveryAssessment,
		})
	case ToolApplyAction:
		requestID = applyCorrelationRequestID(raw, requestID)
		wire, err := decodeApplyActionWire(raw)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		requestID = wire.RequestID
		sourcePhase, err := inferredPayloadPhase(wire)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		if wire.ActionKind == domain.ActionPrepareHandoff &&
			(len(wire.RecoveryApply) == 0 || isJSONNull(wire.RecoveryApply)) {
			read, readErr := server.application.GetTask(ctx, application.GetTaskRequest{
				Host: wire.Host, TaskID: wire.TaskID,
			})
			if readErr != nil {
				return EncodeError(string(requestID), tool, readErr)
			}
			if read.Task.Phase == domain.PhaseReview || read.Task.Phase == domain.PhaseHandoff {
				sourcePhase = read.Task.Phase
			}
		}
		input, err := finishApplyActionInput(wire, sourcePhase)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		result, err := server.application.ApplyAction(ctx, input)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, ApplyActionToolResult{
			Task: projectTask(result.Task), RepositoryClaimReleased: result.Task.Phase.Terminal(),
		})
	case ToolCancelTask:
		input, err := decodeCancelTaskInput(raw, requestID)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		result, err := server.application.CancelTask(ctx, input)
		if err != nil {
			return EncodeError(string(requestID), tool, err)
		}
		return EncodeSuccess(string(requestID), tool, CancelTaskToolResult{
			Task: projectTask(result.Task), RepositoryClaimReleased: result.Task.Phase.Terminal(),
		})
	default:
		return EncodeError(string(requestID), ToolServerInfo, domain.ErrInvalidArgument)
	}
}

// applyCorrelationRequestID extracts only response correlation from one
// completed top-level object. decodeApplyActionWire remains the input authority.
func applyCorrelationRequestID(raw json.RawMessage, fallback domain.ID) domain.ID {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return fallback
	}

	var requestID domain.ID
	found := false
	for decoder.More() {
		nameToken, err := decoder.Token()
		if err != nil {
			return fallback
		}
		name, ok := nameToken.(string)
		if !ok {
			return fallback
		}
		if name != "request_id" {
			var ignored json.RawMessage
			if err := decoder.Decode(&ignored); err != nil {
				return fallback
			}
			continue
		}
		if found {
			return fallback
		}
		found = true
		if err := decoder.Decode(&requestID); err != nil || !requestID.IsValid() {
			return fallback
		}
	}

	closing, err := decoder.Token()
	if err != nil || closing != json.Delim('}') || !found {
		return fallback
	}
	return requestID
}

func sdkTool(definition ToolDefinition, instructions string) *sdkmcp.Tool {
	destructive := definition.Annotations.Destructive
	openWorld := definition.Annotations.OpenWorld
	description := definition.Description
	if definition.Name == ToolOpenTask && instructions != "" {
		description += " " + instructions
	}
	return &sdkmcp.Tool{
		Name:        definition.Name,
		Title:       definition.Name,
		Description: description,
		InputSchema: append(json.RawMessage(nil), definition.InputSchema...),
		Annotations: &sdkmcp.ToolAnnotations{
			Title:           definition.Name,
			ReadOnlyHint:    definition.Annotations.ReadOnly,
			DestructiveHint: &destructive,
			IdempotentHint:  definition.Annotations.Idempotent,
			OpenWorldHint:   &openWorld,
		},
	}
}

func callToolResult(encoded EncodedResult) *sdkmcp.CallToolResult {
	structured := append(json.RawMessage(nil), encoded.JSON...)
	return &sdkmcp.CallToolResult{
		Content:           []sdkmcp.Content{&sdkmcp.TextContent{Text: string(encoded.JSON)}},
		StructuredContent: structured,
		IsError:           encoded.IsError,
	}
}

func randomRequestID() (domain.ID, error) {
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return domain.ID("request-" + hex.EncodeToString(random[:])), nil
}

func resultErrorCode(encoded EncodedResult) domain.ErrorCode {
	var envelope struct {
		Error ErrorResult `json:"error"`
	}
	if json.Unmarshal(encoded.JSON, &envelope) != nil || !envelope.Error.Code.IsValid() {
		return domain.ErrorInternal
	}
	return envelope.Error.Code
}

func resultRequestID(encoded EncodedResult, fallback domain.ID) domain.ID {
	var envelope struct {
		RequestID domain.ID `json:"request_id"`
	}
	if json.Unmarshal(encoded.JSON, &envelope) != nil || !envelope.RequestID.IsValid() {
		return fallback
	}
	return envelope.RequestID
}
