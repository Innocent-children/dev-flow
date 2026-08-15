package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"path/filepath"
	"slices"
	"sort"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

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
