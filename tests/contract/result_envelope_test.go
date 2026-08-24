package contract_test

import (
	"bytes"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	core "github.com/Innocent-children/dev-flow/internal/mcp"
	"strings"
	"testing"
)

func TestCurrentResultEnvelopeContract(t *testing.T) {
	success := core.EncodeSuccess("request-success", core.ToolOpenTask, map[string]any{"created": true, "task": map[string]any{"task_id": "task", "primary_repository_key": "core", "additional_repositories": []any{map[string]any{"key": "docs"}}, "current_action": map[string]any{"repository_binding_digest": strings.Repeat("a", 64)}}})
	assertEnvelope(t, success, false)
	failure := core.EncodeError("request-error", core.ToolGetTask, domain.ErrStorageUnavailable)
	assertEnvelope(t, failure, true)
}
func TestRecoveryUnavailableResultEnvelope(t *testing.T) {
	encoded := core.EncodeError("request-recovery", core.ToolApplyAction, domain.ErrRecoveryUnavailable)
	assertEnvelope(t, encoded, true)
	if !bytes.Contains(encoded.JSON, []byte(`"code":"RECOVERY_UNAVAILABLE"`)) || !bytes.Contains(encoded.JSON, []byte(`"retry_safe":false`)) || !bytes.Contains(encoded.JSON, []byte(`"action":"none"`)) {
		t.Fatal(string(encoded.JSON))
	}
}
func assertEnvelope(t *testing.T, e core.EncodedResult, wantError bool) {
	t.Helper()
	if e.IsError != wantError || len(e.JSON) > domain.MaxResultEnvelopeBytes {
		t.Fatalf("metadata %#v", e)
	}
	var top map[string]json.RawMessage
	if json.Unmarshal(e.JSON, &top) != nil {
		t.Fatal("invalid JSON")
	}
	if _, exists := top["schema_version"]; exists {
		t.Fatal("result envelope must not declare a schema version")
	}
	if wantError {
		if len(top["error"]) == 0 || len(top["recovery"]) == 0 || len(top["result"]) != 0 {
			t.Fatal(string(e.JSON))
		} else {
		}
	} else if len(top["result"]) == 0 || len(top["error"]) != 0 || len(top["recovery"]) != 0 {
		t.Fatal(string(e.JSON))
	}
}
func TestResultEnvelopeEncodedByteBoundaryAndFallback(t *testing.T) {
	encoded := core.EncodeSuccess("request-oversized", core.ToolGetTask, map[string]any{"value": strings.Repeat("x", domain.MaxResultEnvelopeBytes)})
	if !encoded.IsError || len(encoded.JSON) > domain.MaxResultEnvelopeBytes || bytes.Contains(encoded.JSON, []byte(strings.Repeat("x", 128))) {
		t.Fatal("unsafe oversized fallback")
	}
	for _, e := range []core.EncodedResult{core.EncodeSuccess("bad id", core.ToolServerInfo, map[string]any{}), core.EncodeError("request", "bad-tool", domain.ErrInternal)} {
		if !e.IsError {
			t.Fatal("invalid envelope identity accepted")
		}
	}
}
func TestResultEnvelopeEncodingFailureUsesFixedFallback(t *testing.T) {
	encoded := core.EncodeSuccess("request-encoding", core.ToolServerInfo, map[string]any{"unsupported": make(chan int)})
	if !encoded.IsError || bytes.Contains(encoded.JSON, []byte("unsupported")) {
		t.Fatal("encoding failure did not use fixed fallback")
	}
}
