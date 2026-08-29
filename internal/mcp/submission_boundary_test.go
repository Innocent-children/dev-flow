package mcp

import (
	"encoding/json"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// submissionInput builds one closed submission request around a node result.
func submissionInput(t *testing.T, kind domain.ActionKind, nodeResult map[string]any) []byte {
	t.Helper()
	node, err := workflow.NodeDefinitionForActionKind(workflow.StandardProcess(), kind)
	if err != nil {
		t.Fatal(err)
	}
	methodResults := map[string]any{}
	for _, step := range node.SemanticMethodSteps {
		methodResults[string(step.StepID)] = map[string]any{"capability": "", "summary": "Completed the current semantic method step."}
	}
	transitions := make([]string, 0, len(node.OutgoingTransitions))
	for _, transition := range node.OutgoingTransitions {
		transitions = append(transitions, string(transition.TransitionID))
	}
	raw, err := json.Marshal(map[string]any{
		"host": "codex", "task_id": "task-1", "action_id": "action-1",
		"transition_id": transitions[0], "summary": "Result recorded.", "reason": "",
		"artifacts":     map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": methodResults,
		"node_result":   nodeResult,
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func designBaseline(approach string) map[string]any {
	baseline := map[string]any{
		"approach": approach, "components": []any{}, "decisions": []any{},
		"rejected_alternatives": []any{}, "complexity_justification": []any{}, "risks": []any{},
	}
	return baseline
}

func designNodeResultWithoutRevision() map[string]any {
	return map[string]any{
		"problem_class": "none", "baseline": designBaseline("Direct design"),
		"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
	}
}

// TestSubmissionBoundaryAcceptsOmittedSystemStateRevisions proves the node
// submission input boundary accepts a node_result that omits the members Core
// fills, and still accepts the older-client shape that sends the current value.
func TestSubmissionBoundaryAcceptsOmittedSystemStateRevisions(t *testing.T) {
	design := designNodeResultWithoutRevision()
	tasks := map[string]any{
		"problem_class": "none",
		"baseline": map[string]any{"work_items": []any{map[string]any{
			"work_item_id": "work", "summary": "Implement", "expected_paths": []any{"internal/file.go"},
			"acceptance_indexes": []any{0}, "verification_steps": []any{"Run the targeted check"}, "dependencies": []any{},
		}}},
		"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
	}
	implementation := map[string]any{
		"problem_class": "none", "completed_work_item_ids": []any{}, "changed_paths": []any{},
		"no_file_changes": true, "deviations": []any{}, "findings": []any{},
	}
	for _, tc := range []struct {
		tool       string
		kind       domain.ActionKind
		nodeResult map[string]any
	}{
		{ToolSubmitDesign, domain.ActionCompleteDesign, design},
		{ToolSubmitTasks, domain.ActionCompleteTasks, tasks},
		{ToolSubmitImplementation, domain.ActionCompleteImplementation, implementation},
	} {
		t.Run(tc.tool, func(t *testing.T) {
			if err := ValidateToolInput(tc.tool, submissionInput(t, tc.kind, tc.nodeResult)); err != nil {
				t.Fatalf("a submission without the system-state revision was refused: %v", err)
			}
		})
	}
	t.Run("older clients keep sending the current value", func(t *testing.T) {
		older := designNodeResultWithoutRevision()
		older["baseline"].(map[string]any)["requirements_revision"] = 2
		if err := ValidateToolInput(ToolSubmitDesign, submissionInput(t, domain.ActionCompleteDesign, older)); err != nil {
			t.Fatalf("the older-client shape was refused: %v", err)
		}
	})
}

// TestSubmissionBoundaryNamesTheMissingModelMember proves a nested member the
// model owes is refused at the boundary with its exact path, before any Task,
// Event, Evidence or Action operation exists.
func TestSubmissionBoundaryNamesTheMissingModelMember(t *testing.T) {
	missingApproach := designNodeResultWithoutRevision()
	delete(missingApproach["baseline"].(map[string]any), "approach")
	raw := submissionInput(t, domain.ActionCompleteDesign, missingApproach)
	err := ValidateToolInput(ToolSubmitDesign, raw)
	typed, ok := err.(*domain.Error)
	if !ok || !typed.ZeroWrite || typed.Code != domain.ErrorInvalidArgument {
		t.Fatalf("failure=%v want a zero-write INVALID_ARGUMENT", err)
	}
	if len(typed.Violations) != 1 || typed.Violations[0].Path != "node_result.baseline.approach" ||
		typed.Violations[0].Rule != domain.RuleRequiredMemberMissing {
		t.Fatalf("violations=%#v", typed.Violations)
	}
	envelope := decodeEnvelope(t, EncodeError("request-boundary-design", ToolSubmitDesign, err))
	if len(envelope.Error.Details) != 1 || envelope.Error.Details[0].Path != "node_result.baseline.approach" {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	if envelope.Recovery == nil || !envelope.Recovery.RetrySafe || envelope.Recovery.Action != correctCurrentAction {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
	if len(envelope.Recovery.AllowedPaths) != 1 || envelope.Recovery.AllowedPaths[0] != "node_result.baseline.approach" {
		t.Fatalf("allowed paths=%#v", envelope.Recovery.AllowedPaths)
	}
}

// TestSubmissionBoundaryCorrectionBoundaries proves the bounded correction of a
// required-member failure stays closed: an unproven zero-write failure and a
// failure that mixes one ineligible rule offer no correction.
func TestSubmissionBoundaryCorrectionBoundaries(t *testing.T) {
	missingMember := domain.InvalidArgumentViolations(domain.Violation("payload.node_result.baseline.approach", domain.RuleRequiredMemberMissing))
	uncertain := domain.WithoutZeroWriteProof(missingMember)
	envelope := decodeEnvelope(t, EncodeError("request-uncertain-design", ToolSubmitDesign, uncertain))
	if envelope.Recovery == nil || envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 0 {
		t.Fatalf("an unproven zero-write failure offered a correction: %#v", envelope.Recovery)
	}

	mixed := domain.InvalidArgumentViolations(
		domain.Violation("payload.node_result.baseline.approach", domain.RuleRequiredMemberMissing),
		domain.Violation("payload.findings", domain.RuleTextNotNormalized),
	)
	envelope = decodeEnvelope(t, EncodeError("request-mixed-design", ToolSubmitDesign, mixed))
	if envelope.Recovery == nil || envelope.Recovery.RetrySafe || envelope.Recovery.Action == correctCurrentAction || len(envelope.Recovery.AllowedPaths) != 0 {
		t.Fatalf("a mixed failure offered a correction: %#v", envelope.Recovery)
	}
}
