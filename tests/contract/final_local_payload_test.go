package contract_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type finalLocalPayloadMatrix struct {
	FixtureKind string                   `json:"fixture_kind"`
	Entries     []finalLocalPayloadEntry `json:"entries"`
}

type finalLocalPayloadEntry struct {
	Name       string            `json:"name"`
	Node       domain.NodeID     `json:"node"`
	ActionKind domain.ActionKind `json:"action_kind"`
	Payload    json.RawMessage   `json:"payload"`
}

func TestFinalLocalJourneyPayloadMatrixUsesCurrentGraphContract(t *testing.T) {
	t.Parallel()
	matrix := readFinalLocalPayloadMatrix(t)
	if matrix.FixtureKind != "feature_008_final_local_payload_matrix" || len(matrix.Entries) != 10 {
		t.Fatalf("unexpected final-local payload matrix identity: %q/%d", matrix.FixtureKind, len(matrix.Entries))
	}
	expected := []string{
		"requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test",
		"tests_passed_initial", "code_too_complex", "refactor_ready_for_test",
		"tests_passed_after_refactor", "comprehension_passed", "delivery_complete",
	}
	for index, entry := range matrix.Entries {
		if entry.Name != expected[index] {
			t.Fatalf("entry %d name = %q, want %q", index, entry.Name, expected[index])
		}
		definition, ok := finalLocalNodeDefinition(entry.Node)
		if !ok || definition.ActionKind != entry.ActionKind {
			t.Fatalf("%s action kind %q is not the current %s contract", entry.Name, entry.ActionKind, entry.Node)
		}
		assertFinalLocalPayloadCommonShape(t, entry.Payload)
		if err := validateFinalLocalPayload(entry.Node, entry.Payload); err != nil {
			t.Fatalf("%s does not satisfy the current graph payload contract: %v", entry.Name, err)
		}
	}
}

func TestFinalLocalJourneyPayloadMatrixRejectsAttemptOneDrift(t *testing.T) {
	t.Parallel()
	matrix := readFinalLocalPayloadMatrix(t)
	requirements := matrix.Entries[0]
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{
			name: "required evidence is not an artifact role",
			mutate: func(payload map[string]any) {
				payload["artifacts"] = []any{map[string]any{
					"role": "repository_observation", "path": "src/proof-writer.mjs",
					"digest": "a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7c7d7e7f7a7b7", "summary": "Invalid required-evidence projection.",
				}}
			},
		},
		{
			name: "flat requirements node result",
			mutate: func(payload map[string]any) {
				result := payload["node_result"].(map[string]any)
				baseline := result["baseline"].(map[string]any)
				payload["node_result"] = baseline
			},
		},
		{name: "missing problem class", mutate: func(payload map[string]any) { delete(payload["node_result"].(map[string]any), "problem_class") }},
		{name: "missing baseline wrapper", mutate: func(payload map[string]any) { delete(payload["node_result"].(map[string]any), "baseline") }},
		{name: "missing unresolved questions", mutate: func(payload map[string]any) { delete(payload["node_result"].(map[string]any), "unresolved_questions") }},
		{
			name: "missing method step",
			mutate: func(payload map[string]any) {
				items := payload["method_evidence"].([]any)
				payload["method_evidence"] = items[:len(items)-1]
			},
		},
		{name: "caller destination", mutate: func(payload map[string]any) { payload["destination"] = "DESIGN" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			payload := decodePayloadObject(t, requirements.Payload)
			test.mutate(payload)
			raw, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			if err := validateFinalLocalPayload(requirements.Node, raw); err == nil {
				t.Fatalf("invalid payload was accepted: %s", raw)
			}
		})
	}
	duplicate := append([]byte(`{"summary":"duplicate",`), requirements.Payload[1:]...)
	if err := validateFinalLocalPayload(requirements.Node, duplicate); err == nil {
		t.Fatal("duplicate common payload member was accepted")
	}
}

func TestFinalLocalJourneyPayloadMatrixRejectsAttemptTwoDrift(t *testing.T) {
	t.Parallel()
	design := readFinalLocalPayloadMatrix(t).Entries[1]
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "missing requirements revision", mutate: func(payload map[string]any) {
			delete(payload["node_result"].(map[string]any)["baseline"].(map[string]any), "requirements_revision")
		}},
		{name: "missing complexity justification", mutate: func(payload map[string]any) {
			delete(payload["node_result"].(map[string]any)["baseline"].(map[string]any), "complexity_justification")
		}},
		{name: "unknown complexity member", mutate: func(payload map[string]any) {
			payload["node_result"].(map[string]any)["baseline"].(map[string]any)["complexity"] = "invalid prose alias"
		}},
		{name: "previous node method step", mutate: func(payload map[string]any) {
			payload["method_evidence"].([]any)[0].(map[string]any)["step_id"] = "requirements.capture"
		}},
		{name: "array encoded as prose", mutate: func(payload map[string]any) {
			payload["node_result"].(map[string]any)["baseline"].(map[string]any)["components"] = "one component"
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			payload := decodePayloadObject(t, design.Payload)
			test.mutate(payload)
			raw, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			if err := validateFinalLocalPayload(design.Node, raw); err == nil {
				t.Fatalf("invalid attempt-2 payload was accepted: %s", raw)
			}
		})
	}
}

func readFinalLocalPayloadMatrix(t *testing.T) finalLocalPayloadMatrix {
	t.Helper()
	path := filepath.Join(contractRepositoryRoot(t), "tests", "contract", "testdata", "final-local-payloads.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var matrix finalLocalPayloadMatrix
	if err := json.Unmarshal(raw, &matrix); err != nil {
		t.Fatal(err)
	}
	return matrix
}

func finalLocalNodeDefinition(node domain.NodeID) (domain.NodeDefinition, bool) {
	for _, definition := range workflow.StandardProcess().Nodes {
		if definition.NodeID == node {
			return definition, true
		}
	}
	return domain.NodeDefinition{}, false
}

func validateFinalLocalPayload(node domain.NodeID, raw []byte) error {
	envelope, result, err := workflow.DecodeStandardPayload(node, raw)
	if err != nil {
		return err
	}
	definition, ok := finalLocalNodeDefinition(node)
	if !ok {
		return domain.ErrInvalidArgument
	}
	return workflow.ValidatePayload(workflow.StandardProcess(), node, envelope, result, definition.SemanticMethodSteps)
}

func assertFinalLocalPayloadCommonShape(t *testing.T, raw []byte) {
	t.Helper()
	payload := decodePayloadObject(t, raw)
	expected := []string{"artifacts", "method_evidence", "node_result", "reason", "summary", "transition_id"}
	actual := make([]string, 0, len(payload))
	for key := range payload {
		actual = append(actual, key)
	}
	slices.Sort(actual)
	if !slices.Equal(actual, expected) {
		t.Fatalf("payload keys = %v, want %v", actual, expected)
	}
	if _, found := payload["destination"]; found {
		t.Fatal("payload contains caller destination")
	}
	nodeResult, _ := payload["node_result"].(map[string]any)
	for _, removed := range []string{"changed_paths", "no_file_changes"} {
		if _, found := nodeResult[removed]; found {
			t.Fatalf("payload retains removed Host file field %s", removed)
		}
	}
}

func decodePayloadObject(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	return payload
}
