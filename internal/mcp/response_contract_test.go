package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"github.com/google/jsonschema-go/jsonschema"
)

func TestErrorResponseContractSeparatesCapacityPermissionAndCorrection(t *testing.T) {
	budget := domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}
	check := workflow.EvidenceInput{Source: domain.EvidenceSourceAutomated, Name: "check", Status: domain.EvidencePassed, Summary: "Check completed.", CommandCount: 2}
	capacity := workflow.EvaluateVerificationBudget(budget, 1, nil, []workflow.EvidenceInput{check}, nil)
	check.CommandCount, check.FullSuite, check.FullSuiteReason = 1, true, "The shared contract requires the suite."
	permission := workflow.EvaluateVerificationBudget(budget, 1, nil, []workflow.EvidenceInput{check}, nil)
	correction := domain.InvalidArgumentViolations(domain.Violation("payload.node_result.budget_adjustment.additional_checks", domain.RuleBudgetChecksRequired))
	for _, tc := range []struct {
		name        string
		failure     error
		code        domain.ErrorCode
		correctable bool
	}{
		{"capacity", capacity, domain.ErrorVerificationBudgetExceeded, false},
		{"permission", permission, domain.ErrorVerificationNotAllowed, false},
		{"missing explanation", correction, domain.ErrorInvalidArgument, true},
		{"uncertain correction", domain.WithoutZeroWriteProof(correction), domain.ErrorInvalidArgument, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.failure == nil {
				t.Fatal("expected actual failure")
			}
			encoded := EncodeError("request-contract", ToolSubmitTest, tc.failure)
			envelope := decodeEnvelope(t, encoded)
			if envelope.Error.Code != tc.code || envelope.Recovery.RetrySafe != tc.correctable || len(envelope.Error.Details) != 1 {
				t.Fatalf("envelope=%+v", envelope)
			}
			if tc.name == "capacity" && (envelope.Error.Budget == nil || *envelope.Error.Budget != (domain.BudgetFailure{Used: 0, Requested: 2, Limit: 1})) {
				t.Fatal("incorrect counters")
			}
			if tc.name == "permission" && envelope.Error.Budget != nil {
				t.Fatal("permission reported as quantity")
			}
			if tc.correctable && (envelope.Recovery.Action != correctCurrentAction || len(envelope.Recovery.AllowedPaths) != 1 || envelope.Recovery.AllowedPaths[0] != "node_result.budget_adjustment.additional_checks") {
				t.Fatal("incorrect correction fields")
			}
			var input any
			if err := json.Unmarshal(encoded.JSON, &input); err != nil {
				t.Fatal(err)
			}
			validateSkillSchema(t, mustSchemaJSON(t, toolOutputSchema(ToolSubmitTest)), encoded.JSON)
		})
	}
}

func mustSchemaJSON(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestResponseSchemaRejectsMixedOrContradictoryOutcomes(t *testing.T) {
	var schema jsonschema.Schema
	if err := json.Unmarshal(mustSchemaJSON(t, toolOutputSchema(ToolSubmitTest)), &schema); err != nil {
		t.Fatal(err)
	}
	resolved, err := schema.Resolve(nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"result-on-failure", "missing-recovery", "success-with-error", "retry-without-correction", "empty-correction", "paths-with-stop"} {
		t.Run(scenario, func(t *testing.T) {
			encoded := EncodeError("request", ToolSubmitTest, domain.ErrInvalidArgument)
			var value map[string]any
			if err := json.Unmarshal(encoded.JSON, &value); err != nil {
				t.Fatal(err)
			}
			recovery := value["recovery"].(map[string]any)
			switch scenario {
			case "result-on-failure":
				value["result"] = map[string]any{}
			case "missing-recovery":
				delete(value, "recovery")
			case "success-with-error":
				value["ok"] = true
			case "retry-without-correction":
				recovery["retry_safe"] = true
			case "empty-correction":
				recovery["action"] = correctCurrentAction
				recovery["retry_safe"] = true
				recovery["allowed_paths"] = []any{}
			case "paths-with-stop":
				recovery["allowed_paths"] = []any{"node_result.findings"}
			}
			if err := resolved.Validate(value); err == nil {
				t.Fatal("invalid response accepted")
			}
		})
	}
}

func TestCheckExplanationCorrectionRequiresSubmissionTool(t *testing.T) {
	failure := domain.InvalidArgumentViolations(domain.Violation("payload.node_result.budget_adjustment.additional_checks", domain.RuleBudgetChecksRequired))
	result := decodeEnvelope(t, EncodeError("request", ToolGetTask, failure))
	if result.Recovery.RetrySafe || len(result.Recovery.AllowedPaths) != 0 {
		t.Fatal("read tool offered a TEST submission correction")
	}
}

func TestSuccessRequiresAnActualResultAndErrorsUseFixedMessages(t *testing.T) {
	var task *domain.ProcessTask
	for _, result := range []any{nil, task, map[string]any(nil)} {
		response := decodeEnvelope(t, EncodeSuccess("request", ToolSubmitTest, result))
		if response.OK || response.Error == nil || response.Error.Code != domain.ErrorInternal {
			t.Fatal("empty success escaped the response contract")
		}
	}
	failure := domain.InvalidArgumentViolations(domain.Violation("payload.node_result.checks", domain.RuleRequiredCollectionNonEmpty))
	failure.Violations[0].Message = "private submitted content"
	encoded := EncodeError("request", ToolSubmitTest, failure)
	response := decodeEnvelope(t, encoded)
	if response.Error.Details[0].Message != domain.RuleRequiredCollectionNonEmpty.Message() {
		t.Fatal("error interpolated submitted content")
	}
}

func TestHandshakeRejectsNonObjectArgumentsWithDetail(t *testing.T) {
	for _, input := range []string{"null", "[]", "true", "{", ""} {
		response := decodeEnvelope(t, (&Server{version: "test"}).dispatch(context.Background(), ToolServerInfo, "invalid-arguments", []byte(input)))
		if response.OK || response.Error == nil || len(response.Error.Details) != 1 || response.Error.Details[0].Path != "arguments" || response.Error.Details[0].Rule != domain.RuleArgumentsObjectRequired {
			t.Fatalf("input=%q response=%+v", input, response)
		}
	}
}

func TestHistoryResolutionReportsEachInvalidMember(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		for _, tc := range []struct {
			name, choice, reason string
			paths                []string
		}{
			{"empty reason", "accept_current_history", "", []string{"history_resolution.reason"}},
			{"untrimmed reason", "accept_current_history", " accepted ", []string{"history_resolution.reason"}},
			{"invalid choice", "unsupported", "The user accepted this history.", []string{"history_resolution.choice"}},
			{"both members", "unsupported", "", []string{"history_resolution.choice", "history_resolution.reason"}},
		} {
			t.Run(host+"/"+tc.name, func(t *testing.T) {
				input := mustSchemaJSON(t, map[string]any{"host": host, "task_id": "task-example", "action_id": "blocked-action", "history_resolution": map[string]any{"choice": tc.choice, "reason": tc.reason}})
				encoded := missingTaskSkillServer(t).dispatch(context.Background(), ToolResolveBlocker, "history-invalid", input)
				response := decodeEnvelope(t, encoded)
				if response.OK || response.Error.Code != domain.ErrorInvalidArgument || len(response.Error.Details) != len(tc.paths) {
					t.Fatalf("unexpected response: %s", encoded.JSON)
				}
				for i, path := range tc.paths {
					rule := domain.RuleTextNotNormalized
					if path == "history_resolution.choice" {
						rule = domain.RuleEnumValueInvalid
					}
					if response.Error.Details[i] != domain.Violation(path, rule) {
						t.Fatalf("wrong field: %s", encoded.JSON)
					}
				}
				validateSkillSchema(t, mustSchemaJSON(t, toolOutputSchema(ToolResolveBlocker)), encoded.JSON)
			})
		}
	}
}
