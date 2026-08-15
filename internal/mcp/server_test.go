package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestApplyActionErrorPreservesCallerRequestID(t *testing.T) {
	const callerID = domain.ID("request-caller-001")
	validPayload := `{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}`
	validRequest := applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE", validPayload)

	tests := []struct {
		name string
		raw  json.RawMessage
	}{
		{
			name: "unknown nested field",
			raw: applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE",
				`{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true,"unknown":"private-payload-marker"}`),
		},
		{
			name: "duplicate nested field",
			raw: applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE",
				`{"result":"succeeded","summary":"first","summary":"second","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}`),
		},
		{
			name: "wrong payload enum",
			raw: applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE",
				`{"result":"wrong-value","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}`),
		},
		{
			name: "wrong payload field type",
			raw: applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE",
				`{"result":"succeeded","summary":"implemented","changed_paths":"not-an-array","no_file_changes":true,"deviations":[],"scope_confirmed":true}`),
		},
		{
			name: "missing required nested field",
			raw: applyActionTestRequest(`"`+string(callerID)+`"`, "IMPLEMENT_CHANGE",
				`{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[]}`),
		},
		{
			name: "payload and action mismatch",
			raw:  applyActionTestRequest(`"`+string(callerID)+`"`, "PLAN_CHANGE", validPayload),
		},
		{
			name: "trailing JSON",
			raw:  append(append(json.RawMessage(nil), validRequest...), []byte(` true`)...),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server, diagnostics, dependencies := newApplyCorrelationTestServer(t, "request-fallback-001")
			response := callRawApplyAction(server, tt.raw)
			encoded := requireInvalidApplyResponse(t, response, diagnostics, dependencies, callerID)
			if bytes.Contains(encoded, []byte("private-payload-marker")) ||
				bytes.Contains(diagnostics.Bytes(), []byte("private-payload-marker")) {
				t.Fatal("invalid ApplyAction payload leaked into response or diagnostics")
			}
		})
	}
}

func TestApplyActionInvalidRequestIDUsesFallback(t *testing.T) {
	const (
		callerID   = "request-caller-001"
		fallbackID = domain.ID("request-fallback-001")
	)
	validPayload := `{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}`
	validRequest := string(applyActionTestRequest(`"`+callerID+`"`, "IMPLEMENT_CHANGE", validPayload))

	tests := []struct {
		name          string
		raw           json.RawMessage
		forbiddenEcho string
	}{
		{
			name: "missing request ID",
			raw:  json.RawMessage(strings.Replace(validRequest, `"request_id":"`+callerID+`",`, "", 1)),
		},
		{
			name:          "empty request ID",
			raw:           applyActionTestRequest(`""`, "IMPLEMENT_CHANGE", validPayload),
			forbiddenEcho: `"request_id":""`,
		},
		{
			name:          "request ID contains whitespace",
			raw:           applyActionTestRequest(`"request caller"`, "IMPLEMENT_CHANGE", validPayload),
			forbiddenEcho: "request caller",
		},
		{
			name:          "request ID exceeds limit",
			raw:           applyActionTestRequest(`"`+strings.Repeat("x", domain.MaxIdentifierBytes+1)+`"`, "IMPLEMENT_CHANGE", validPayload),
			forbiddenEcho: strings.Repeat("x", domain.MaxIdentifierBytes+1),
		},
		{
			name:          "request ID is not a string",
			raw:           applyActionTestRequest(`42`, "IMPLEMENT_CHANGE", validPayload),
			forbiddenEcho: `"request_id":42`,
		},
		{
			name: "duplicate top-level request ID",
			raw: json.RawMessage(strings.Replace(validRequest, `"request_id":"`+callerID+`"`,
				`"request_id":"`+callerID+`","request_id":"request-caller-002"`, 1)),
			forbiddenEcho: callerID,
		},
		{
			name: "top level is not an object",
			raw:  json.RawMessage(`[]`),
		},
		{
			name:          "malformed top-level object",
			raw:           json.RawMessage(`{"request_id":"` + callerID + `","payload":`),
			forbiddenEcho: callerID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server, diagnostics, dependencies := newApplyCorrelationTestServer(t, fallbackID)
			response := callRawApplyAction(server, tt.raw)
			encoded := requireInvalidApplyResponse(t, response, diagnostics, dependencies, fallbackID)
			if tt.forbiddenEcho != "" && (bytes.Contains(encoded, []byte(tt.forbiddenEcho)) ||
				bytes.Contains(diagnostics.Bytes(), []byte(tt.forbiddenEcho))) {
				t.Fatalf("invalid request ID %q was echoed", tt.forbiddenEcho)
			}
		})
	}
}

func TestOfficialSDKListsExactToolsAndCallsServerInfo(t *testing.T) {
	ctx := context.Background()
	taskStore, err := store.Open(ctx, filepath.Join(t.TempDir(), "sdk-test.db"))
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	defer taskStore.Close()
	service, err := application.NewService(taskStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("construct application service: %v", err)
	}
	var diagnostics bytes.Buffer
	server, err := NewServer(service, "0.1.0", &ServerOptions{
		Diagnostics: NewDiagnostics(&diagnostics),
		NewRequestID: func() (domain.ID, error) {
			return "request-sdk-server-info", nil
		},
	})
	if err != nil {
		t.Fatalf("construct MCP server: %v", err)
	}

	serverTransport, clientTransport := sdkmcp.NewInMemoryTransports()
	serverSession, err := server.sdk.Connect(ctx, serverTransport, nil)
	if err != nil {
		t.Fatalf("connect official SDK server: %v", err)
	}
	defer serverSession.Close()
	client := sdkmcp.NewClient(&sdkmcp.Implementation{Name: "dev-flow-contract-test", Version: "0.1.0"}, nil)
	clientSession, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatalf("connect official SDK client: %v", err)
	}
	defer clientSession.Close()

	listed, err := clientSession.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("list tools over official SDK: %v", err)
	}
	names := make([]string, len(listed.Tools))
	for index, tool := range listed.Tools {
		names[index] = tool.Name
		if tool.Annotations == nil || tool.Annotations.OpenWorldHint == nil || *tool.Annotations.OpenWorldHint ||
			tool.Annotations.DestructiveHint == nil {
			t.Errorf("tool %s annotations are not explicit and conservative", tool.Name)
		}
	}
	wantSDKNames := ToolNames()
	sort.Strings(wantSDKNames)
	if !slices.Equal(names, wantSDKNames) {
		t.Fatalf("official SDK tool set = %v, want %v", names, wantSDKNames)
	}

	called, err := clientSession.CallTool(ctx, &sdkmcp.CallToolParams{
		Name:      ToolServerInfo,
		Arguments: struct{}{},
	})
	if err != nil || called.IsError || len(called.Content) != 1 {
		t.Fatalf("server_info call result/error = %#v/%v", called, err)
	}
	text, ok := called.Content[0].(*sdkmcp.TextContent)
	if !ok {
		t.Fatalf("server_info content type = %T", called.Content[0])
	}
	var envelope struct {
		SchemaVersion int              `json:"schema_version"`
		OK            bool             `json:"ok"`
		RequestID     string           `json:"request_id"`
		Tool          string           `json:"tool"`
		Result        ServerInfoResult `json:"result"`
	}
	if err := json.Unmarshal([]byte(text.Text), &envelope); err != nil {
		t.Fatalf("decode server_info envelope: %v", err)
	}
	if envelope.SchemaVersion != 1 || !envelope.OK || envelope.RequestID != "request-sdk-server-info" ||
		envelope.Tool != ToolServerInfo || envelope.Result.Product != "dev-flow" ||
		envelope.Result.Version != "0.1.0" || envelope.Result.Transport != "stdio" ||
		!slices.Equal(envelope.Result.Tools, ToolNames()) ||
		!slices.Equal(envelope.Result.SupportedHosts, []string{"codex", "deepseek"}) {
		t.Fatalf("server_info envelope = %#v", envelope)
	}
	if !bytes.Contains(diagnostics.Bytes(), []byte(`"event":"tool_call_completed"`)) ||
		bytes.Contains(diagnostics.Bytes(), []byte("sdk-test.db")) {
		t.Fatalf("diagnostics are missing or unsafe: %q", diagnostics.String())
	}
}

type applyCorrelationDependencies struct {
	storeCalls    int
	observerCalls int
}

func (dependencies *applyCorrelationDependencies) LoadTask(context.Context, domain.ID) (domain.Task, error) {
	dependencies.storeCalls++
	return domain.Task{}, domain.ErrInternal
}

func (dependencies *applyCorrelationDependencies) LoadActiveTask(context.Context, domain.Digest) (domain.Task, error) {
	dependencies.storeCalls++
	return domain.Task{}, domain.ErrInternal
}

func (dependencies *applyCorrelationDependencies) CommitTask(context.Context, store.TaskMutation) error {
	dependencies.storeCalls++
	return domain.ErrInternal
}

func (dependencies *applyCorrelationDependencies) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	dependencies.observerCalls++
	return domain.RepositoryBinding{}, domain.ErrInternal
}

func newApplyCorrelationTestServer(
	t *testing.T,
	fallback domain.ID,
) (*Server, *bytes.Buffer, *applyCorrelationDependencies) {
	t.Helper()
	dependencies := &applyCorrelationDependencies{}
	service, err := application.NewService(dependencies, dependencies)
	if err != nil {
		t.Fatalf("construct correlation test service: %v", err)
	}
	diagnostics := new(bytes.Buffer)
	server, err := NewServer(service, "0.1.0", &ServerOptions{
		Diagnostics: NewDiagnostics(diagnostics),
		NewRequestID: func() (domain.ID, error) {
			return fallback, nil
		},
	})
	if err != nil {
		t.Fatalf("construct correlation test server: %v", err)
	}
	return server, diagnostics, dependencies
}

func applyActionTestRequest(requestID, actionKind, payload string) json.RawMessage {
	return json.RawMessage(`{"request_id":` + requestID +
		`,"host":"codex","task_id":"task-1","revision":3,"action_id":"action-1","action_kind":"` + actionKind +
		`","repository_binding_digest":"` + strings.Repeat("a", 64) + `","payload":` + payload + `}`)
}

func callRawApplyAction(server *Server, raw json.RawMessage) *sdkmcp.CallToolResult {
	return server.handle(context.Background(), ToolApplyAction, &sdkmcp.CallToolRequest{
		Params: &sdkmcp.CallToolParamsRaw{Name: ToolApplyAction, Arguments: raw},
	})
}

func requireInvalidApplyResponse(
	t *testing.T,
	response *sdkmcp.CallToolResult,
	diagnostics *bytes.Buffer,
	dependencies *applyCorrelationDependencies,
	wantRequestID domain.ID,
) []byte {
	t.Helper()
	if response == nil || !response.IsError || len(response.Content) != 1 {
		t.Fatalf("invalid ApplyAction response = %#v", response)
	}
	text, ok := response.Content[0].(*sdkmcp.TextContent)
	if !ok {
		t.Fatalf("invalid ApplyAction content type = %T", response.Content[0])
	}
	encoded := []byte(text.Text)
	var envelope errorEnvelope
	if err := json.Unmarshal(encoded, &envelope); err != nil {
		t.Fatalf("decode invalid ApplyAction envelope: %v", err)
	}
	if envelope.OK || envelope.RequestID != string(wantRequestID) || envelope.Tool != ToolApplyAction ||
		envelope.Error.Code != domain.ErrorInvalidArgument {
		t.Fatalf("invalid ApplyAction envelope = %#v", envelope)
	}
	var event diagnosticEvent
	if err := json.Unmarshal(bytes.TrimSpace(diagnostics.Bytes()), &event); err != nil {
		t.Fatalf("decode invalid ApplyAction diagnostic: %v; output = %q", err, diagnostics.String())
	}
	if event.RequestID != string(wantRequestID) || event.Tool != ToolApplyAction ||
		event.Code != domain.ErrorInvalidArgument || event.Event != "tool_call_failed" {
		t.Fatalf("invalid ApplyAction diagnostic = %#v", event)
	}
	if dependencies.storeCalls != 0 || dependencies.observerCalls != 0 {
		t.Fatalf("invalid ApplyAction reached Application dependencies: store=%d observer=%d",
			dependencies.storeCalls, dependencies.observerCalls)
	}
	return encoded
}
