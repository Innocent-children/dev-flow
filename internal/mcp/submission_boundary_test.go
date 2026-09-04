package mcp

import (
	"encoding/json"
	"errors"
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
		"artifacts":      map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": methodResults,
		"node_result":    nodeResult,
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
		"findings": []any{},
	}
}

func deliverySubmissionNodeResult() map[string]any {
	return map[string]any{
		"problem_class": "none", "unverified_items": []any{}, "risks": []any{}, "findings": []any{},
	}
}

// TestSubmissionBoundaryAcceptsOmittedSystemStateRevisions proves the node
// submission input boundary accepts only the Host-owned shape.
func TestSubmissionBoundaryAcceptsOmittedSystemStateRevisions(t *testing.T) {
	design := designNodeResultWithoutRevision()
	tasks := map[string]any{
		"problem_class": "none",
		"baseline": map[string]any{"work_items": []any{map[string]any{
			"work_item_id": "work", "summary": "Implement", "expected_paths": []any{"internal/file.go"},
			"acceptance_indexes": []any{0}, "verification_steps": []any{"Run the targeted check"}, "dependencies": []any{},
		}}, "verification_plan": map[string]any{"checks": []any{map[string]any{"name": "targeted-check", "rationale": "The check covers the changed file."}}, "initial_budget": map[string]any{"level": "targeted", "max_automatic_commands": 4, "allow_full_suite": false, "allow_manual_handoff": true}, "full_suite_expected": false, "test_code_changes_expected": true}},
		"findings": []any{},
	}
	implementation := map[string]any{
		"problem_class": "none", "completed_work_item_ids": []any{},
		"deviations": []any{}, "findings": []any{},
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
	t.Run("Core-owned revision is rejected", func(t *testing.T) {
		submitted := designNodeResultWithoutRevision()
		submitted["baseline"].(map[string]any)["requirements_revision"] = 2
		if err := ValidateToolInput(ToolSubmitDesign, submissionInput(t, domain.ActionCompleteDesign, submitted)); err == nil {
			t.Fatal("the submission boundary accepted a Core-owned revision")
		}
	})
}

func TestSubmissionBoundaryRejectsLegacyRepositoryEffectMembers(t *testing.T) {
	for _, member := range []string{"changed_paths", "no_file_changes"} {
		nodeResult := designNodeResultWithoutRevision()
		if member == "changed_paths" {
			nodeResult[member] = []any{}
		} else {
			nodeResult[member] = true
		}
		err := ValidateToolInput(ToolSubmitDesign, submissionInput(t, domain.ActionCompleteDesign, nodeResult))
		var typed *domain.Error
		if !errors.As(err, &typed) || len(typed.Violations) != 1 || typed.Violations[0].Path != "node_result."+member || typed.Violations[0].Rule != domain.RuleUnknownMember {
			t.Fatalf("legacy %s error=%v", member, err)
		}
	}
}

// TestDeliverySubmissionBoundaryRejectsCoreOwnedMembers proves the public
// Delivery contract accepts only Host-owned facts. The complete internal
// Delivery result still receives these members from Core hydration.
func TestDeliverySubmissionBoundaryRejectsCoreOwnedMembers(t *testing.T) {
	minimal := deliverySubmissionNodeResult()
	if err := ValidateToolInput(ToolSubmitDelivery, submissionInput(t, domain.ActionCompleteDelivery, minimal)); err != nil {
		t.Fatalf("minimal Delivery submission was refused: %v", err)
	}

	coreOwned := map[string]any{
		"acceptance":              []any{},
		"automated_evidence_ids":  []any{},
		"manual_evidence_ids":     []any{},
		"test_record_id":          "test-current",
		"comprehension_record_id": "comprehension-current",
	}
	for name, value := range coreOwned {
		t.Run(name, func(t *testing.T) {
			withCoreOwnedMember := deliverySubmissionNodeResult()
			withCoreOwnedMember[name] = value
			err := ValidateToolInput(ToolSubmitDelivery, submissionInput(t, domain.ActionCompleteDelivery, withCoreOwnedMember))
			var typed *domain.Error
			if !errors.As(err, &typed) || typed.Code != domain.ErrorInvalidArgument || len(typed.Violations) != 1 ||
				typed.Violations[0].Path != "node_result."+name || typed.Violations[0].Rule != domain.RuleUnknownMember {
				t.Fatalf("Core-owned member error=%#v", err)
			}
		})
	}
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
