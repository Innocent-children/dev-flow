package mcp

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestFixedInternalErrorFallbackIsValidJSON(t *testing.T) {
	result := fixedInternalErrorFallback()
	if !result.IsError {
		t.Fatal("fixed INTERNAL_ERROR fallback is not marked as an error")
	}
	if !json.Valid(result.JSON) {
		t.Fatalf("fixed INTERNAL_ERROR fallback is invalid JSON: %q", result.JSON)
	}
	if bytes.HasPrefix(result.JSON, []byte(`{\"`)) {
		t.Fatalf("fixed INTERNAL_ERROR fallback retains an escaped object prefix: %q", result.JSON)
	}
	if !WithinResultEnvelopeLimit(result.JSON) {
		t.Fatalf("fixed INTERNAL_ERROR fallback exceeds result limit: %d bytes", len(result.JSON))
	}

	var envelope errorEnvelope
	if err := json.Unmarshal(result.JSON, &envelope); err != nil {
		t.Fatalf("decode fixed INTERNAL_ERROR fallback: %v", err)
	}
	if envelope.SchemaVersion != resultSchemaVersion || envelope.OK ||
		envelope.RequestID != "request-invalid" || !domain.ID(envelope.RequestID).IsValid() ||
		envelope.Tool != ToolServerInfo || envelope.Error.Code != domain.ErrorInternal ||
		envelope.Error.Message == "" || envelope.Error.Details != nil ||
		envelope.Recovery.RetrySafe || envelope.Recovery.Action != "report_internal_error" ||
		envelope.Recovery.Message == "" {
		t.Fatalf("fixed INTERNAL_ERROR fallback envelope = %#v", envelope)
	}

	lower := strings.ToLower(string(result.JSON))
	for _, sensitive := range []string{
		"/users/", "select ", "raw git", "environment", "database", "source content", "stack trace",
	} {
		if strings.Contains(lower, sensitive) {
			t.Errorf("fixed INTERNAL_ERROR fallback contains sensitive marker %q", sensitive)
		}
	}
}
