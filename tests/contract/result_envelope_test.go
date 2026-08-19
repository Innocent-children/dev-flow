package contract_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
)

type committedEnvelopeSchema struct {
	Type                 string                     `json:"type"`
	AdditionalProperties bool                       `json:"additionalProperties"`
	Required             []string                   `json:"required"`
	Properties           map[string]json.RawMessage `json:"properties"`
	Defs                 map[string]json.RawMessage `json:"$defs"`
	AllOf                []json.RawMessage          `json:"allOf"`
}

func TestGraphContractResultEnvelopeUsesSchema2(t *testing.T) {
	encoded := coremcp.EncodeSuccess("request", "dev_flow_get_task", map[string]any{"current_node": "REQUIREMENTS"})
	var envelope map[string]any
	if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope["schema_version"] != float64(2) {
		t.Fatalf("schema=%v", envelope["schema_version"])
	}
}

func TestResultEnvelopeCommittedSchemaShape(t *testing.T) {
	t.Parallel()

	schema := loadCommittedEnvelopeSchema(t)
	if schema.Type != "object" || schema.AdditionalProperties {
		t.Fatal("result envelope must be one closed object")
	}
	if !slices.Equal(schema.Required, []string{"schema_version", "ok", "request_id", "tool"}) {
		t.Fatalf("required envelope fields = %v", schema.Required)
	}
	for _, name := range []string{"schema_version", "ok", "request_id", "tool", "result", "error", "recovery"} {
		if len(schema.Properties[name]) == 0 {
			t.Errorf("committed envelope schema is missing property %q", name)
		}
	}
	for _, name := range []string{"identifier", "digest", "blockerCondition", "operationReference", "committedOperationProof", "recoveryAssessment"} {
		if len(schema.Defs[name]) == 0 {
			t.Errorf("committed envelope schema is missing definition %q", name)
		}
	}
	if len(schema.AllOf) != 3 {
		t.Fatalf("committed envelope conditions = %d, want 3", len(schema.AllOf))
	}

	assertRawJSONContains(t, schema.Properties["schema_version"], `"const":1`)
	assertRawJSONContains(t, schema.Properties["tool"], `"dev_flow_server_info"`, `"dev_flow_cancel_task"`)
	assertRawJSONContains(t, schema.Properties["error"], `"INTERNAL_ERROR"`, `"STORAGE_UNAVAILABLE"`)
	assertRawJSONContains(t, schema.Defs["identifier"], `"minLength":1`, `"maxLength":128`)
	assertRawJSONContains(t, schema.Defs["digest"], `"pattern":"^[0-9a-f]{64}$"`)
	assertRawJSONContains(t, schema.Defs["recoveryAssessment"],
		`"not_started"`, `"completed_and_recorded"`, `"completed_but_unrecorded"`,
		`"partially_completed"`, `"conflicting"`, `"current_action_id"`,
		`"committed_proof"`, `"unblock_condition"`)
}

func TestResultEnvelopeCommittedSchemaCases(t *testing.T) {
	t.Parallel()

	root := markdownRepositoryRoot(t)
	validRead, err := os.ReadFile(filepath.Join(root, "protocol", "fixtures", "recovery-not-started.json"))
	if err != nil {
		t.Fatalf("read recovery fixture: %v", err)
	}
	validError, err := os.ReadFile(filepath.Join(root, "protocol", "fixtures", "repository-drift.json"))
	if err != nil {
		t.Fatalf("read error fixture: %v", err)
	}
	validRead = compactContractFixture(t, validRead)
	validError = compactContractFixture(t, validError)

	validSuccess := coremcp.EncodeSuccess("request-contract-success", coremcp.ToolServerInfo, struct {
		Product string `json:"product"`
	}{Product: "dev-flow"})
	if validSuccess.IsError {
		t.Fatal("small success encoded as an error")
	}

	tests := []struct {
		name    string
		value   []byte
		wantErr bool
	}{
		{name: "success", value: validSuccess.JSON},
		{name: "error", value: validError},
		{name: "read success recovery assessment", value: validRead},
		{name: "success and error are exclusive", value: []byte(`{"schema_version":1,"ok":true,"request_id":"r","tool":"dev_flow_server_info","result":{},"error":{"code":"INTERNAL_ERROR","message":"failed"}}`), wantErr: true},
		{name: "success rejects error recovery", value: []byte(`{"schema_version":1,"ok":true,"request_id":"r","tool":"dev_flow_server_info","result":{},"recovery":{"retry_safe":false,"action":"none","message":"stop"}}`), wantErr: true},
		{name: "error requires recovery", value: []byte(`{"schema_version":1,"ok":false,"request_id":"r","tool":"dev_flow_server_info","error":{"code":"INTERNAL_ERROR","message":"failed"}}`), wantErr: true},
		{name: "error rejects result", value: []byte(`{"schema_version":1,"ok":false,"request_id":"r","tool":"dev_flow_server_info","result":{},"error":{"code":"INTERNAL_ERROR","message":"failed"},"recovery":{"retry_safe":false,"action":"report_internal_error","message":"report"}}`), wantErr: true},
		{name: "read success requires assessment member", value: []byte(`{"schema_version":1,"ok":true,"request_id":"r","tool":"dev_flow_get_task","result":{"task":{}}}`), wantErr: true},
		{name: "assessment only belongs to reads", value: []byte(`{"schema_version":1,"ok":true,"request_id":"r","tool":"dev_flow_apply_action","result":{"recovery_assessment":null}}`), wantErr: true},
		{name: "bad classification", value: replaceJSONText(validRead, `"classification":"not_started"`, `"classification":"unknown"`), wantErr: true},
		{name: "nullable action id wrong shape", value: replaceJSONText(validRead, `"current_action_id":"action-implement-0003"`, `"current_action_id":3`), wantErr: true},
		{name: "bad digest", value: replaceJSONText(validRead, `"issuance_binding_digest":"`+strings.Repeat("4", 64)+`"`, `"issuance_binding_digest":"not-a-digest"`), wantErr: true},
		{name: "empty identifier", value: replaceJSONText(validRead, "operation-uncertain-0001", ""), wantErr: true},
		{name: "bad tool enum", value: replaceJSONText(validRead, "dev_flow_get_task", "dev_flow_list_tasks"), wantErr: true},
		{name: "bad error enum", value: replaceJSONText(validError, "REPOSITORY_DRIFT", "RAW_GIT_ERROR"), wantErr: true},
		{name: "unknown top-level member", value: appendBeforeFinalObject(validError, `,"debug":true`), wantErr: true},
		{name: "trailing JSON", value: append(append([]byte(nil), validError...), []byte(` {}`)...), wantErr: true},
		{name: "trailing scalar JSON", value: append(append([]byte(nil), validError...), []byte(` true`)...), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCommittedEnvelope(tt.value)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateCommittedEnvelope() error = %v, wantErr %t", err, tt.wantErr)
			}
		})
	}
}

func TestResultEnvelopeEncodedByteBoundary(t *testing.T) {
	t.Parallel()

	within := bytes.Repeat([]byte{'a'}, domain.MaxResultEnvelopeBytes)
	if !coremcp.WithinResultEnvelopeLimit(within) {
		t.Fatal("exact Core result limit was rejected")
	}
	if coremcp.WithinResultEnvelopeLimit(append(within, 'a')) {
		t.Fatal("result above Core result limit was accepted")
	}

	encoded := coremcp.EncodeSuccess("request-oversized", coremcp.ToolGetTask, struct {
		Value string `json:"value"`
	}{Value: strings.Repeat("x", domain.MaxResultEnvelopeBytes)})
	if !encoded.IsError || len(encoded.JSON) > domain.MaxResultEnvelopeBytes {
		t.Fatalf("oversized result fallback = isError %t, bytes %d", encoded.IsError, len(encoded.JSON))
	}
	if err := validateCommittedEnvelope(encoded.JSON); err != nil {
		t.Fatalf("oversized fixed fallback violates committed envelope: %v\n%s", err, encoded.JSON)
	}
	if bytes.Contains(encoded.JSON, []byte(strings.Repeat("x", 256))) {
		t.Fatal("oversized result content leaked into fixed fallback")
	}
}

func loadCommittedEnvelopeSchema(t *testing.T) committedEnvelopeSchema {
	t.Helper()
	path := filepath.Join(markdownRepositoryRoot(t), "specs", "002-govern-and-resume-single-repository-task", "contracts", "result-envelope.schema.json")
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read committed schema: %v", err)
	}
	var schema committedEnvelopeSchema
	if err := json.Unmarshal(contents, &schema); err != nil {
		t.Fatalf("decode committed schema: %v", err)
	}
	return schema
}

func validateCommittedEnvelope(data []byte) error {
	var top map[string]json.RawMessage
	if err := strictContractJSON(data, &top); err != nil {
		return err
	}
	allowed := []string{"schema_version", "ok", "request_id", "tool", "result", "error", "recovery"}
	for name := range top {
		if !slices.Contains(allowed, name) {
			return fmt.Errorf("unknown envelope member %q", name)
		}
	}
	for _, required := range []string{"schema_version", "ok", "request_id", "tool"} {
		if len(top[required]) == 0 {
			return fmt.Errorf("missing envelope member %q", required)
		}
	}
	var schemaVersion int
	var ok bool
	var requestID, tool string
	if json.Unmarshal(top["schema_version"], &schemaVersion) != nil || schemaVersion != 1 ||
		json.Unmarshal(top["ok"], &ok) != nil || json.Unmarshal(top["request_id"], &requestID) != nil ||
		len(requestID) == 0 || len(requestID) > domain.MaxIdentifierBytes ||
		json.Unmarshal(top["tool"], &tool) != nil || !slices.Contains(coremcp.ToolNames(), tool) {
		return fmt.Errorf("invalid envelope identity")
	}
	if ok {
		if len(top["result"]) == 0 || len(top["error"]) != 0 || len(top["recovery"]) != 0 {
			return fmt.Errorf("invalid success exclusivity")
		}
		var result map[string]json.RawMessage
		if err := json.Unmarshal(top["result"], &result); err != nil {
			return fmt.Errorf("success result is not an object: %w", err)
		}
		assessment, hasAssessment := result["recovery_assessment"]
		readTool := tool == coremcp.ToolGetTask || tool == coremcp.ToolGetNextAction
		if readTool != hasAssessment {
			return fmt.Errorf("read assessment placement mismatch")
		}
		if hasAssessment && !bytes.Equal(bytes.TrimSpace(assessment), []byte("null")) {
			if err := validateRecoveryAssessment(assessment); err != nil {
				return err
			}
		}
		return nil
	}
	if len(top["result"]) != 0 || len(top["error"]) == 0 || len(top["recovery"]) == 0 {
		return fmt.Errorf("invalid error exclusivity")
	}
	var failure struct {
		Code    string          `json:"code"`
		Message string          `json:"message"`
		Details json.RawMessage `json:"details"`
	}
	if err := strictContractJSON(top["error"], &failure); err != nil ||
		!slices.Contains(stableErrorCodes(), failure.Code) || len(failure.Message) == 0 ||
		len(failure.Message) > domain.MaxErrorMessageBytes {
		return fmt.Errorf("invalid error object")
	}
	var guidance struct {
		RetrySafe bool   `json:"retry_safe"`
		Action    string `json:"action"`
		Message   string `json:"message"`
	}
	if err := strictContractJSON(top["recovery"], &guidance); err != nil ||
		!slices.Contains([]string{"none", "read_task", "read_next_action", "resolve_repository_drift", "use_origin_host", "cancel_or_finish_active_task", "repair_storage", "report_internal_error"}, guidance.Action) ||
		len(guidance.Message) == 0 || len(guidance.Message) > domain.MaxErrorMessageBytes {
		return fmt.Errorf("invalid error recovery guidance")
	}
	return nil
}

func validateRecoveryAssessment(data []byte) error {
	var value struct {
		Classification        string          `json:"classification"`
		Operation             json.RawMessage `json:"operation"`
		CurrentActionID       json.RawMessage `json:"current_action_id"`
		IssuanceDigest        string          `json:"issuance_binding_digest"`
		AuthoritativeDigest   string          `json:"authoritative_binding_digest"`
		ObservedDigest        string          `json:"observed_binding_digest"`
		OperationDigest       string          `json:"operation_payload_digest"`
		CommittedProof        json.RawMessage `json:"committed_proof"`
		UnblockCondition      json.RawMessage `json:"unblock_condition"`
		RepositoryRelation    string          `json:"repository_relation"`
		LastOperationRelation string          `json:"last_operation_relation"`
		OperationEvidence     string          `json:"operation_evidence"`
		NextAdvice            string          `json:"next_advice"`
		ActionRetrySafe       bool            `json:"action_retry_safe"`
		TaskRevision          uint64          `json:"task_revision"`
		ObservedAt            string          `json:"observed_at"`
	}
	if err := strictContractJSON(data, &value); err != nil {
		return err
	}
	if !slices.Contains([]string{"not_started", "completed_and_recorded", "completed_but_unrecorded", "partially_completed", "conflicting"}, value.Classification) || value.TaskRevision == 0 {
		return fmt.Errorf("invalid recovery classification or revision")
	}
	for _, digest := range []string{value.IssuanceDigest, value.AuthoritativeDigest, value.ObservedDigest, value.OperationDigest} {
		if !validFixtureDigest(digest) {
			return fmt.Errorf("invalid recovery digest")
		}
	}
	if !validNullableIdentifier(value.CurrentActionID) || !validNullableObject(value.CommittedProof) ||
		!validNullableObject(value.UnblockCondition) || value.ObservedAt == "" {
		return fmt.Errorf("invalid nullable recovery member")
	}
	var operation struct {
		OperationID      string `json:"operation_id"`
		SourcePhase      string `json:"source_phase"`
		ExpectedRevision uint64 `json:"expected_revision"`
		ActionID         string `json:"action_id"`
		ActionKind       string `json:"action_kind"`
	}
	if err := strictContractJSON(value.Operation, &operation); err != nil ||
		operation.OperationID == "" || operation.ActionID == "" || operation.ExpectedRevision == 0 ||
		len(operation.OperationID) > domain.MaxIdentifierBytes || len(operation.ActionID) > domain.MaxIdentifierBytes {
		return fmt.Errorf("invalid recovery operation")
	}
	return nil
}

func strictContractJSON(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		return fmt.Errorf("trailing JSON: %w", err)
	}
	return nil
}

func validNullableIdentifier(raw json.RawMessage) bool {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return true
	}
	var value string
	return json.Unmarshal(raw, &value) == nil && len(value) > 0 && len(value) <= domain.MaxIdentifierBytes
}

func validNullableObject(raw json.RawMessage) bool {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return true
	}
	var value map[string]json.RawMessage
	return json.Unmarshal(raw, &value) == nil
}

func validFixtureDigest(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' && character < 'a' || character > 'f' {
			return false
		}
	}
	return true
}

func stableErrorCodes() []string {
	return []string{
		"INVALID_ARGUMENT", "NOT_GIT_REPOSITORY", "TASK_NOT_FOUND", "ACTIVE_TASK_CONFLICT",
		"HOST_OWNERSHIP_CONFLICT", "REVISION_CONFLICT", "ACTION_STALE", "REPOSITORY_DRIFT",
		"VERIFICATION_BUDGET_EXCEEDED", "TASK_BLOCKED", "TASK_TERMINAL", "SCHEMA_UNSUPPORTED",
		"STORAGE_UNAVAILABLE", "INTERNAL_ERROR",
	}
}

func assertRawJSONContains(t *testing.T, raw json.RawMessage, fragments ...string) {
	t.Helper()
	compact := new(bytes.Buffer)
	if err := json.Compact(compact, raw); err != nil {
		t.Fatalf("compact schema fragment: %v", err)
	}
	for _, fragment := range fragments {
		if !strings.Contains(compact.String(), fragment) {
			t.Errorf("schema fragment %s does not contain %s", compact.String(), fragment)
		}
	}
}

func replaceJSONText(value []byte, old, replacement string) []byte {
	return []byte(strings.Replace(string(value), old, replacement, 1))
}

func compactContractFixture(t *testing.T, value []byte) []byte {
	t.Helper()
	var compact bytes.Buffer
	if err := json.Compact(&compact, value); err != nil {
		t.Fatalf("compact contract fixture: %v", err)
	}
	return compact.Bytes()
}

func appendBeforeFinalObject(value []byte, suffix string) []byte {
	trimmed := bytes.TrimSpace(value)
	return append(append(append([]byte(nil), trimmed[:len(trimmed)-1]...), suffix...), '}')
}
