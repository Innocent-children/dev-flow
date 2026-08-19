package contract_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestMCPContractGraphCatalogAndClosedInput(t *testing.T) {
	if len(coremcp.ToolNames()) != 6 {
		t.Fatal("expected six tools")
	}
	if err := coremcp.ValidateToolInput(coremcp.ToolGetTask, []byte(`{"host":"codex","task_id":"task","destination":"DONE"}`)); err == nil {
		t.Fatal("destination input accepted")
	}
}

func TestFeature005PublicSurfaceFreeze(t *testing.T) {
	t.Parallel()

	wantToolSchemaSHA256 := map[string]string{
		coremcp.ToolServerInfo:    "9652cb940365521269cb61c4b4bc7f0b50af44d585c3c8485db25e857a5cd24e",
		coremcp.ToolOpenTask:      "7bf0b72ab0a36a057a2089f8376decf7f051861428645e70b979123a4002f59d",
		coremcp.ToolGetTask:       "5dfd5536e22457aa4b3788ab48b14e6386727604d615bc51f30f9785d53e5f2f",
		coremcp.ToolGetNextAction: "5dfd5536e22457aa4b3788ab48b14e6386727604d615bc51f30f9785d53e5f2f",
		coremcp.ToolApplyAction:   "6356ae925fba84f4920dac06091341793d7e159c6c2611b097309e1fa16f937e",
		coremcp.ToolCancelTask:    "6498b14e73a3a380ab21486f3e4f1d33b05f7cb1c67d0fb9796ff4a954439f0e",
	}
	for _, tool := range coremcp.ToolCatalog() {
		got := fmt.Sprintf("%x", sha256.Sum256(tool.InputSchema))
		want, exists := wantToolSchemaSHA256[tool.Name]
		if !exists {
			t.Errorf("Feature 005 observed an unreviewed tool %q", tool.Name)
			continue
		}
		if want == "" {
			t.Logf("Feature 005 baseline input schema %s = %s", tool.Name, got)
			continue
		}
		if got != want {
			t.Errorf("Feature 005 input schema %s digest = %s, want frozen %s", tool.Name, got, want)
		}
		delete(wantToolSchemaSHA256, tool.Name)
	}
	for name, digest := range wantToolSchemaSHA256 {
		if digest == "" {
			t.Errorf("Feature 005 input schema %s needs its reviewed baseline digest", name)
		} else {
			t.Errorf("Feature 005 frozen tool %s is missing", name)
		}
	}

	wantPhases := []domain.Phase{
		domain.PhaseIntake,
		domain.PhaseAssess,
		domain.PhasePlan,
		domain.PhaseImplement,
		domain.PhaseVerify,
		domain.PhaseReview,
		domain.PhaseHandoff,
		domain.PhaseDone,
		domain.PhaseBlocked,
		domain.PhaseCancelled,
	}
	for _, phase := range wantPhases {
		if !phase.IsValid() {
			t.Errorf("Feature 005 frozen phase %q is invalid", phase)
		}
	}
	for _, value := range []domain.Phase{"RECOVERING", "RETRYING", "UNKNOWN"} {
		if value.IsValid() {
			t.Errorf("Feature 005 observed unreviewed phase %q", value)
		}
	}

	wantRecovery := []domain.RecoveryClassification{
		domain.RecoveryNotStarted,
		domain.RecoveryCompletedAndRecorded,
		domain.RecoveryCompletedButUnrecorded,
		domain.RecoveryPartiallyCompleted,
		domain.RecoveryConflicting,
	}
	if len(wantRecovery) != 5 {
		t.Fatalf("Feature 005 recovery vocabulary count = %d, want 5", len(wantRecovery))
	}
	for _, classification := range wantRecovery {
		if !classification.IsValid() {
			t.Errorf("Feature 005 frozen recovery classification %q is invalid", classification)
		}
	}
	for _, value := range []domain.RecoveryClassification{"unknown", "retry", "completed"} {
		if value.IsValid() {
			t.Errorf("Feature 005 observed unreviewed recovery classification %q", value)
		}
	}

	wantErrors := []domain.ErrorCode{
		domain.ErrorInvalidArgument,
		domain.ErrorNotGitRepository,
		domain.ErrorTaskNotFound,
		domain.ErrorActiveTaskConflict,
		domain.ErrorHostOwnershipConflict,
		domain.ErrorRevisionConflict,
		domain.ErrorActionStale,
		domain.ErrorRepositoryDrift,
		domain.ErrorVerificationBudgetExceeded,
		domain.ErrorTaskBlocked,
		domain.ErrorTaskTerminal,
		domain.ErrorSchemaUnsupported,
		domain.ErrorStorageUnavailable,
		domain.ErrorInternal,
	}
	if len(wantErrors) != 14 {
		t.Fatalf("Feature 005 stable error count = %d, want 14", len(wantErrors))
	}
	for _, code := range wantErrors {
		if !code.IsValid() {
			t.Errorf("Feature 005 frozen error code %q is invalid", code)
		}
	}
	for _, value := range []domain.ErrorCode{"RECOVERY_UNKNOWN", "RETRY_REQUIRED", "DATABASE_BUSY"} {
		if value.IsValid() {
			t.Errorf("Feature 005 observed unreviewed error code %q", value)
		}
	}

	if store.SchemaVersion != 1 {
		t.Fatalf("Feature 005 SQLite schema version = %d, want frozen version 1", store.SchemaVersion)
	}
}

func TestMCPToolCatalogIsExactStableAndConservative(t *testing.T) {
	t.Parallel()

	wantNames := []string{
		"dev_flow_server_info",
		"dev_flow_open_task",
		"dev_flow_get_task",
		"dev_flow_get_next_action",
		"dev_flow_apply_action",
		"dev_flow_cancel_task",
	}
	if names := coremcp.ToolNames(); !slices.Equal(names, wantNames) {
		t.Fatalf("ToolNames() = %v, want %v", names, wantNames)
	}
	catalog := coremcp.ToolCatalog()
	if len(catalog) != len(wantNames) {
		t.Fatalf("tool catalog length = %d, want %d", len(catalog), len(wantNames))
	}
	for index, tool := range catalog {
		if tool.Name != wantNames[index] || tool.Description == "" || len(tool.InputSchema) == 0 {
			t.Errorf("catalog[%d] = %#v", index, tool)
		}
		assertClosedObjectSchemas(t, tool.Name, tool.InputSchema)
		if tool.Annotations.OpenWorld {
			t.Errorf("tool %s claims open-world authority", tool.Name)
		}
		readOnly := tool.Name == coremcp.ToolServerInfo || tool.Name == coremcp.ToolGetTask || tool.Name == coremcp.ToolGetNextAction
		if tool.Annotations.ReadOnly != readOnly {
			t.Errorf("tool %s read-only annotation = %t, want %t", tool.Name, tool.Annotations.ReadOnly, readOnly)
		}
		if tool.Annotations.Idempotent != readOnly {
			t.Errorf("tool %s idempotent annotation = %t, want %t", tool.Name, tool.Annotations.Idempotent, readOnly)
		}
		if tool.Annotations.Destructive != (tool.Name == coremcp.ToolCancelTask) {
			t.Errorf("tool %s destructive annotation = %t", tool.Name, tool.Annotations.Destructive)
		}
	}

	forbidden := []string{"shell", "resolve_blocker", "recovery", "list_task", "http", "debug"}
	joined := strings.Join(coremcp.ToolNames(), "\n")
	for _, fragment := range forbidden {
		if strings.Contains(joined, fragment) {
			t.Errorf("tool catalog contains forbidden surface %q", fragment)
		}
	}
}

func TestOpenTaskSchemaPublishesCompleteInlineNewTaskContract(t *testing.T) {
	t.Parallel()

	var schema map[string]any
	for _, tool := range coremcp.ToolCatalog() {
		if tool.Name != coremcp.ToolOpenTask {
			continue
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("decode open-task schema: %v", err)
		}
		break
	}
	if schema == nil {
		t.Fatal("open-task schema is missing")
	}

	properties := requireSchemaObject(t, schema, "properties")
	requireSchemaRequired(t, schema, []string{"host", "repository_path"})
	newTaskProperty := requireSchemaObject(t, properties, "new_task")
	branches, ok := newTaskProperty["anyOf"].([]any)
	if !ok || len(branches) != 2 {
		t.Fatalf("new_task anyOf = %#v, want object and null", newTaskProperty["anyOf"])
	}
	newTask, ok := branches[0].(map[string]any)
	if !ok || newTask["type"] != "object" || newTask["additionalProperties"] != false {
		t.Fatalf("new_task object schema = %#v", branches[0])
	}
	if _, usesReference := newTask["$ref"]; usesReference {
		t.Fatalf("new_task remains hidden behind a reference: %#v", newTask)
	}
	requireSchemaRequired(t, newTask, []string{
		"goal", "scope", "out_of_scope", "acceptance_criteria", "verification_budget",
	})

	newTaskProperties := requireSchemaObject(t, newTask, "properties")
	goal := requireSchemaObject(t, newTaskProperties, "goal")
	if goal["type"] != "string" || goal["minLength"] != float64(1) || goal["maxLength"] != float64(8192) {
		t.Errorf("new_task.goal schema = %#v", goal)
	}
	for _, name := range []string{"scope", "out_of_scope", "acceptance_criteria"} {
		field := requireSchemaObject(t, newTaskProperties, name)
		items := requireSchemaObject(t, field, "items")
		wantItemLimit := float64(1024)
		if name == "acceptance_criteria" {
			wantItemLimit = 2048
		}
		if field["type"] != "array" || field["maxItems"] != float64(64) ||
			items["type"] != "string" || items["maxLength"] != wantItemLimit {
			t.Errorf("new_task.%s schema = %#v", name, field)
		}
		if name == "acceptance_criteria" && field["minItems"] != float64(1) {
			t.Errorf("new_task.acceptance_criteria minimum = %#v", field["minItems"])
		}
	}

	budget := requireSchemaObject(t, newTaskProperties, "verification_budget")
	if budget["type"] != "object" || budget["additionalProperties"] != false {
		t.Fatalf("verification_budget schema = %#v", budget)
	}
	requireSchemaRequired(t, budget, []string{
		"level", "max_automatic_commands", "allow_full_suite", "allow_manual_handoff",
	})
	budgetProperties := requireSchemaObject(t, budget, "properties")
	level := requireSchemaObject(t, budgetProperties, "level")
	if got := schemaStrings(t, level["enum"]); !slices.Equal(got, []string{"minimal", "targeted", "full"}) {
		t.Fatalf("verification level enum = %v", got)
	}
	commands := requireSchemaObject(t, budgetProperties, "max_automatic_commands")
	if commands["type"] != "integer" || commands["minimum"] != float64(0) || commands["maximum"] != float64(20) {
		t.Errorf("max_automatic_commands schema = %#v", commands)
	}
	for _, name := range []string{"allow_full_suite", "allow_manual_handoff"} {
		if field := requireSchemaObject(t, budgetProperties, name); field["type"] != "boolean" {
			t.Errorf("verification_budget.%s schema = %#v", name, field)
		}
	}

	definitions := requireSchemaObject(t, schema, "$defs")
	compatibilityNewTask := requireSchemaObject(t, definitions, "newTask")
	compatibilityNewTaskProperties := requireSchemaObject(t, compatibilityNewTask, "properties")
	compatibilityNewTaskProperties["verification_budget"] = requireSchemaObject(t, definitions, "verificationBudget")
	if !reflect.DeepEqual(newTask, compatibilityNewTask) {
		t.Fatalf("inline new_task drifted from shared compatibility definition\ninline: %#v\nshared: %#v", newTask, compatibilityNewTask)
	}
	if branches[1] != nil {
		nullBranch, nullOK := branches[1].(map[string]any)
		if !nullOK || nullBranch["type"] != "null" {
			t.Fatalf("new_task null branch = %#v", branches[1])
		}
	}
}

func TestApplyActionSchemaDiscriminatesClosedPayloadsByActionKind(t *testing.T) {
	t.Parallel()

	var raw json.RawMessage
	for _, tool := range coremcp.ToolCatalog() {
		if tool.Name == coremcp.ToolApplyAction {
			raw = tool.InputSchema
			break
		}
	}
	var schema map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &schema) != nil {
		t.Fatal("apply-action schema is missing or invalid")
	}
	allOf, ok := schema["allOf"].([]any)
	if !ok || len(allOf) != 1 {
		t.Fatalf("apply-action allOf = %#v, want one discriminator", schema["allOf"])
	}
	discriminator, ok := allOf[0].(map[string]any)
	if !ok {
		t.Fatalf("apply-action discriminator = %#v", allOf[0])
	}
	branches, ok := discriminator["oneOf"].([]any)
	if !ok || len(branches) != 7 {
		t.Fatalf("apply-action branches = %#v, want seven", discriminator["oneOf"])
	}

	want := map[string]struct {
		title string
		ref   string
	}{
		"ASSESS_TASK":      {title: "INTAKE / ASSESS_TASK", ref: "#/$defs/assessPayload"},
		"PLAN_CHANGE":      {title: "ASSESS / PLAN_CHANGE", ref: "#/$defs/planPayload"},
		"IMPLEMENT_CHANGE": {title: "PLAN / IMPLEMENT_CHANGE", ref: "#/$defs/implementPayload"},
		"VERIFY_CHANGE":    {title: "IMPLEMENT / VERIFY_CHANGE", ref: "#/$defs/verifyPayload"},
		"REVIEW_CHANGE":    {title: "VERIFY / REVIEW_CHANGE", ref: "#/$defs/reviewPayload"},
		"PREPARE_HANDOFF":  {title: "REVIEW or HANDOFF / PREPARE_HANDOFF", ref: "#/$defs/prepareHandoffPayload"},
		"RESOLVE_BLOCKER":  {title: "BLOCKED / RESOLVE_BLOCKER", ref: "#/$defs/resolveBlockerPayload"},
	}
	seen := make(map[string]bool, len(want))
	for _, rawBranch := range branches {
		branch, branchOK := rawBranch.(map[string]any)
		properties, propertiesOK := branch["properties"].(map[string]any)
		kindSchema, kindOK := properties["action_kind"].(map[string]any)
		kind, valueOK := kindSchema["const"].(string)
		payloadSchema, payloadOK := properties["payload"].(map[string]any)
		alternatives, alternativesOK := payloadSchema["anyOf"].([]any)
		if !branchOK || !propertiesOK || !kindOK || !valueOK || !payloadOK || !alternativesOK || len(alternatives) != 2 {
			t.Fatalf("invalid apply-action branch: %#v", rawBranch)
		}
		expected, known := want[kind]
		if !known || seen[kind] || branch["title"] != expected.title {
			t.Fatalf("unexpected or duplicate apply-action branch: %#v", rawBranch)
		}
		ref, _ := alternatives[0].(map[string]any)["$ref"].(string)
		nullType, _ := alternatives[1].(map[string]any)["type"].(string)
		if ref != expected.ref || nullType != "null" {
			t.Fatalf("payload branch for %s = %#v", kind, alternatives)
		}
		seen[kind] = true
	}
	if len(seen) != len(want) {
		t.Fatalf("mapped action kinds = %v, want %v", seen, want)
	}
}

func TestMCPStrictInputBoundary(t *testing.T) {
	t.Parallel()

	validOpen := `{"host":"codex","repository_path":"/workspace/example","new_task":{"goal":"goal","scope":[],"out_of_scope":[],"acceptance_criteria":["criterion"],"verification_budget":{"level":"targeted","max_automatic_commands":2,"allow_full_suite":false,"allow_manual_handoff":true}}}`
	validApply := `{"request_id":"request-apply","host":"codex","task_id":"task-1","revision":3,"action_id":"action-1","action_kind":"IMPLEMENT_CHANGE","repository_binding_digest":"` + strings.Repeat("a", 64) + `","payload":{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true},"recovery_apply":null}`
	validProbe := `{"host":"codex","task_id":"task-1","operation_probe":{"operation_id":"request-original","source_phase":"PLAN","expected_revision":3,"action_id":"action-1","action_kind":"IMPLEMENT_CHANGE","repository_binding_digest":"` + strings.Repeat("a", 64) + `","payload":{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}}}`

	tests := []struct {
		name string
		tool string
		json string
	}{
		{name: "unknown top-level field", tool: coremcp.ToolServerInfo, json: `{"debug":true}`},
		{name: "unknown nested field", tool: coremcp.ToolOpenTask, json: strings.Replace(validOpen, `"goal":"goal"`, `"goal":"goal","command":"pwd"`, 1)},
		{name: "duplicate member", tool: coremcp.ToolOpenTask, json: strings.Replace(validOpen, `"host":"codex"`, `"host":"codex","host":"deepseek"`, 1)},
		{name: "duplicate nested member", tool: coremcp.ToolOpenTask, json: strings.Replace(validOpen, `"goal":"goal"`, `"goal":"goal","goal":"other"`, 1)},
		{name: "alias field", tool: coremcp.ToolGetTask, json: `{"host":"codex","taskId":"task-1","operation_probe":null}`},
		{name: "wrong host enum", tool: coremcp.ToolGetTask, json: `{"host":"other","task_id":"task-1","operation_probe":null}`},
		{name: "wrong action enum", tool: coremcp.ToolApplyAction, json: strings.Replace(validApply, "IMPLEMENT_CHANGE", "SHELL", 1)},
		{name: "malformed nested payload", tool: coremcp.ToolApplyAction, json: strings.Replace(validApply, `"scope_confirmed":true`, `"scope_confirmed":true,"raw_output":"secret"`, 1)},
		{name: "malformed probe payload", tool: coremcp.ToolGetTask, json: strings.Replace(validProbe, `"summary":"implemented"`, `"summary":3`, 1)},
		{name: "trailing JSON", tool: coremcp.ToolOpenTask, json: validOpen + ` {}`},
		{name: "typed shape mismatch", tool: coremcp.ToolGetNextAction, json: `{"host":"codex","task_id":3,"operation_probe":null}`},
		{name: "null normal apply payload", tool: coremcp.ToolApplyAction, json: strings.Replace(validApply, `{"result":"succeeded","summary":"implemented","changed_paths":[],"no_file_changes":true,"deviations":[],"scope_confirmed":true}`, `null`, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := coremcp.ValidateToolInput(tt.tool, []byte(tt.json)); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("ValidateToolInput(%s) error = %v, want INVALID_ARGUMENT", tt.tool, err)
			}
		})
	}

	for _, valid := range []struct {
		tool string
		json string
	}{
		{tool: coremcp.ToolServerInfo, json: `{}`},
		{tool: coremcp.ToolOpenTask, json: validOpen},
		{tool: coremcp.ToolGetTask, json: validProbe},
		{tool: coremcp.ToolApplyAction, json: validApply},
		{tool: coremcp.ToolCancelTask, json: `{"host":"deepseek","task_id":"task-1","revision":2,"reason":"cancel"}`},
	} {
		if err := coremcp.ValidateToolInput(valid.tool, []byte(valid.json)); err != nil {
			t.Errorf("valid %s input rejected: %v", valid.tool, err)
		}
	}
}

func TestMCPStableErrorEnvelopesAreClosedAndRedacted(t *testing.T) {
	t.Parallel()

	tests := []struct {
		err  error
		code domain.ErrorCode
	}{
		{domain.ErrInvalidArgument, domain.ErrorInvalidArgument},
		{domain.ErrNotGitRepository, domain.ErrorNotGitRepository},
		{domain.ErrTaskNotFound, domain.ErrorTaskNotFound},
		{domain.ErrActiveTaskConflict, domain.ErrorActiveTaskConflict},
		{domain.ErrHostOwnershipConflict, domain.ErrorHostOwnershipConflict},
		{domain.ErrRevisionConflict, domain.ErrorRevisionConflict},
		{domain.ErrActionStale, domain.ErrorActionStale},
		{domain.ErrRepositoryDrift, domain.ErrorRepositoryDrift},
		{domain.ErrVerificationBudgetExceeded, domain.ErrorVerificationBudgetExceeded},
		{domain.ErrTaskBlocked, domain.ErrorTaskBlocked},
		{domain.ErrTaskTerminal, domain.ErrorTaskTerminal},
		{domain.ErrSchemaUnsupported, domain.ErrorSchemaUnsupported},
		{domain.ErrStorageUnavailable, domain.ErrorStorageUnavailable},
		{domain.ErrInternal, domain.ErrorInternal},
	}
	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			encoded := coremcp.EncodeError("request-error", coremcp.ToolApplyAction, tt.err)
			if !encoded.IsError || len(encoded.JSON) > domain.MaxResultEnvelopeBytes {
				t.Fatalf("encoded error metadata = %#v", encoded)
			}
			var envelope struct {
				OK     bool            `json:"ok"`
				Result json.RawMessage `json:"result"`
				Error  struct {
					Code    domain.ErrorCode `json:"code"`
					Message string           `json:"message"`
				} `json:"error"`
				Recovery struct {
					Action  string `json:"action"`
					Message string `json:"message"`
				} `json:"recovery"`
			}
			if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
				t.Fatalf("decode error envelope: %v", err)
			}
			if envelope.OK || envelope.Error.Code != tt.code || envelope.Error.Message == "" ||
				envelope.Recovery.Action == "" || envelope.Recovery.Message == "" || len(envelope.Result) != 0 {
				t.Fatalf("error envelope = %s", encoded.JSON)
			}
		})
	}

	secret := "/Users/private/repository/secret.db SELECT * FROM tasks raw-git-output"
	encoded := coremcp.EncodeError("request-unexpected", coremcp.ToolGetTask, errors.New(secret))
	if bytes.Contains(encoded.JSON, []byte(secret)) || bytes.Contains(encoded.JSON, []byte("/Users/private")) ||
		bytes.Contains(encoded.JSON, []byte("SELECT *")) {
		t.Fatalf("unexpected error leaked private details: %s", encoded.JSON)
	}
	if !bytes.Contains(encoded.JSON, []byte(`"code":"INTERNAL_ERROR"`)) {
		t.Fatalf("unexpected error did not map to INTERNAL_ERROR: %s", encoded.JSON)
	}

	html := coremcp.EncodeSuccess("request-html", coremcp.ToolServerInfo, struct {
		Value string `json:"value"`
	}{Value: "<ready>"})
	if bytes.Contains(html.JSON, []byte(`\u003c`)) || !bytes.Contains(html.JSON, []byte(`<ready>`)) ||
		bytes.HasSuffix(html.JSON, []byte("\n")) {
		t.Fatalf("result is not compact SetEscapeHTML(false) JSON: %q", html.JSON)
	}
}

func assertClosedObjectSchemas(t *testing.T, tool string, raw json.RawMessage) {
	t.Helper()
	var schema any
	if err := json.Unmarshal(raw, &schema); err != nil {
		t.Fatalf("tool %s schema is invalid JSON: %v", tool, err)
	}
	var visit func(path string, value any)
	visit = func(path string, value any) {
		switch typed := value.(type) {
		case map[string]any:
			if typed["type"] == "object" {
				closed, present := typed["additionalProperties"].(bool)
				if !present || closed {
					t.Errorf("tool %s object schema %s is not closed", tool, path)
				}
			}
			for name, child := range typed {
				visit(path+"/"+name, child)
			}
		case []any:
			for index, child := range typed {
				visit(path+"/"+string(rune('0'+index)), child)
			}
		}
	}
	visit("$", schema)
}

func requireSchemaObject(t *testing.T, parent map[string]any, name string) map[string]any {
	t.Helper()
	value, ok := parent[name].(map[string]any)
	if !ok {
		t.Fatalf("schema member %s = %#v, want object", name, parent[name])
	}
	return value
}

func requireSchemaRequired(t *testing.T, schema map[string]any, want []string) {
	t.Helper()
	if got := schemaStrings(t, schema["required"]); !slices.Equal(got, want) {
		t.Fatalf("required members = %v, want %v", got, want)
	}
}

func schemaStrings(t *testing.T, value any) []string {
	t.Helper()
	raw, ok := value.([]any)
	if !ok {
		t.Fatalf("schema string list = %#v", value)
	}
	result := make([]string, len(raw))
	for index, item := range raw {
		text, textOK := item.(string)
		if !textOK {
			t.Fatalf("schema string list item %d = %#v", index, item)
		}
		result[index] = text
	}
	return result
}
