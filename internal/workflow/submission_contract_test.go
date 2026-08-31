package workflow

import (
	"encoding/json"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// canonicalPayload builds one well-formed standard payload around a node result
// so a test can mutate exactly one member.
func canonicalPayload(t *testing.T, nodeResult map[string]any) []byte {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"transition_id": "current_ready",
		"summary":       "Result recorded.",
		"reason":        "",
		"artifacts":     []any{},
		"method_evidence": []any{map[string]any{
			"step_id": "step.one", "status": "plain_fallback", "capability": "", "summary": "Completed the step.",
		}},
		"node_result": nodeResult,
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// decodeMissingMemberViolations decodes one node result through the canonical
// contract and returns the structured failure it must produce.
func decodeMissingMemberViolations(t *testing.T, node domain.NodeID, nodeResult map[string]any) []domain.ContractViolation {
	t.Helper()
	_, _, err := DecodeStandardPayload(node, canonicalPayload(t, nodeResult))
	if err == nil {
		t.Fatalf("the %s payload with a missing required member was accepted", node)
	}
	typed, ok := err.(*domain.Error)
	if !ok || typed.Code != domain.ErrorInvalidArgument || !typed.ZeroWrite {
		t.Fatalf("failure=%v want a zero-write INVALID_ARGUMENT with field detail", err)
	}
	if len(typed.Violations) == 0 {
		t.Fatalf("failure=%v carries no field detail", err)
	}
	return typed.Violations
}

func assertViolation(t *testing.T, violations []domain.ContractViolation, path string, rule domain.ViolationRule) {
	t.Helper()
	for _, violation := range violations {
		if violation.Path == path && violation.Rule == rule {
			return
		}
	}
	t.Fatalf("violations=%#v want (%s, %s)", violations, path, rule)
}

// TestCanonicalDecodeNamesEveryNestedMissingMember proves a nested required
// member that is missing is reported with its exact stable path instead of a
// bare invalid-argument refusal.
func TestCanonicalDecodeNamesEveryNestedMissingMember(t *testing.T) {
	t.Run("design baseline requirements_revision", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeDesign, map[string]any{
			"problem_class": "none",
			"baseline": map[string]any{
				"approach": "Direct design", "components": []any{}, "decisions": []any{},
				"rejected_alternatives": []any{}, "complexity_justification": []any{}, "risks": []any{},
			},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.baseline.requirements_revision", domain.RuleRequiredMemberMissing)
	})
	t.Run("tasks baseline design_revision", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeTasks, map[string]any{
			"problem_class": "none",
			"baseline": map[string]any{
				"work_items": []any{workItemInput("work", []any{0})},
			},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.baseline.design_revision", domain.RuleRequiredMemberMissing)
	})
	t.Run("tasks work item verification_steps", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeTasks, map[string]any{
			"problem_class": "none",
			"baseline": map[string]any{
				"design_revision": 1,
				"work_items":      []any{workItemWithoutVerificationSteps("work", []any{0})},
			},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.baseline.work_items[0].verification_steps", domain.RuleRequiredMemberMissing)
	})
	t.Run("comprehension user_confirmation status", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeComprehensionReview, map[string]any{
			"problem_class": "none", "explained_components": []any{}, "unresolved_questions": []any{},
			"unnecessary_abstractions": []any{}, "maintenance_risks": []any{},
			"user_confirmation": map[string]any{"source": "user", "summary": "The developer confirmed."},
			"findings":          []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.user_confirmation.status", domain.RuleRequiredMemberMissing)
	})
	t.Run("delivery acceptance status", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeDelivery, map[string]any{
			"problem_class":          "none",
			"acceptance":             []any{map[string]any{"criterion": "The field is returned"}},
			"automated_evidence_ids": []any{}, "manual_evidence_ids": []any{}, "test_record_id": "test-1",
			"comprehension_record_id": "comprehension-1", "unverified_items": []any{}, "risks": []any{},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.acceptance[0].status", domain.RuleRequiredMemberMissing)
	})
	t.Run("test check member", func(t *testing.T) {
		violations := decodeMissingMemberViolations(t, domain.NodeTest, map[string]any{
			"problem_class": "none",
			"checks":        []any{map[string]any{"source": "user", "status": "passed", "summary": "Manual check.", "command_count": 0, "full_suite": false}},
			"failed_items":  []any{}, "unverified_items": []any{}, "manual_handoff_items": []any{},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		})
		assertViolation(t, violations, "payload.node_result.checks[0].name", domain.RuleRequiredMemberMissing)
	})
	t.Run("envelope artifact member", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"transition_id": "current_ready", "summary": "Result recorded.", "reason": "",
			"artifacts": []any{map[string]any{"role": "other_process", "path": "docs/note.md", "summary": "Note."}},
			"method_evidence": []any{map[string]any{
				"step_id": "step.one", "status": "plain_fallback", "capability": "", "summary": "Completed the step.",
			}},
			"node_result": map[string]any{"problem_class": "none", "checks": []any{}, "failed_items": []any{},
				"unverified_items": []any{}, "manual_handoff_items": []any{}, "findings": []any{},
				"changed_paths": []any{}, "no_file_changes": true},
		})
		if err != nil {
			t.Fatal(err)
		}
		_, _, err = DecodeStandardPayload(domain.NodeTest, raw)
		typed, ok := err.(*domain.Error)
		if !ok || len(typed.Violations) != 1 || typed.Violations[0].Path != "payload.artifacts[0].digest" {
			t.Fatalf("failure=%v want the artifact digest member", err)
		}
	})
}

func workItemInput(id string, acceptance []any) map[string]any {
	return map[string]any{
		"work_item_id": id, "summary": "Implement the work", "expected_paths": []any{"internal/file.go"},
		"acceptance_indexes": acceptance, "verification_steps": []any{"Run the targeted check"}, "dependencies": []any{},
	}
}

func workItemWithoutVerificationSteps(id string, acceptance []any) map[string]any {
	item := workItemInput(id, acceptance)
	delete(item, "verification_steps")
	return item
}

// TestCanonicalContractKeepsSystemStateRevisionsRequired proves the canonical
// schema keeps owning the three system-state members, so the persisted payload,
// retained records and the apply boundary are unchanged.
func TestCanonicalContractKeepsSystemStateRevisionsRequired(t *testing.T) {
	for _, kind := range []domain.ActionKind{domain.ActionCompleteDesign, domain.ActionCompleteTasks, domain.ActionCompleteImplementation} {
		t.Run(string(kind), func(t *testing.T) {
			for _, entry := range ActionPayloadSchemas() {
				if entry.Kind != kind {
					continue
				}
				nodeResult := nodeResultSchemaOf(entry.Schema)
				if kind == domain.ActionCompleteImplementation {
					if !schemaRequires(nodeResult, "task_plan_revision") {
						t.Fatal("the canonical implementation schema lost task_plan_revision")
					}
					return
				}
				name := "requirements_revision"
				if kind == domain.ActionCompleteTasks {
					name = "design_revision"
				}
				if !schemaRequires(baselineObjectOf(nodeResult), name) {
					t.Fatalf("the canonical %s baseline lost %s", kind, name)
				}
				return
			}
			t.Fatalf("no canonical schema for %s", kind)
		})
	}
}

func nodeResultSchemaOf(entrySchema map[string]any) map[string]any {
	properties, _ := entrySchema["properties"].(map[string]any)
	nodeResult, _ := properties["node_result"].(map[string]any)
	return nodeResult
}

func baselineObjectOf(nodeResult map[string]any) map[string]any {
	nodeProperties, _ := nodeResult["properties"].(map[string]any)
	return nullableObjectSchema(nodeProperties["baseline"])
}

// schemaDeclaresProperty reports whether name stays a declared property at the
// level where the submission contract relaxed it.
func schemaDeclaresProperty(schema map[string]any, name string) bool {
	if schema == nil {
		return false
	}
	nodeProperties, _ := schema["properties"].(map[string]any)
	if _, declared := nodeProperties[name]; declared {
		return true
	}
	return schemaDeclaresProperty(baselineObjectOf(schema), name)
}

func schemaRequires(schema map[string]any, name string) bool {
	for _, required := range schemaRequiredNames(schema) {
		if required == name {
			return true
		}
	}
	return false
}

// TestSubmissionContractProjectsOnlyHostOwnedMembers proves revision members
// stay optional while Core-owned Delivery authority members are absent from the
// closed submission contract.
func TestSubmissionContractProjectsOnlyHostOwnedMembers(t *testing.T) {
	designWithoutRevision := map[string]any{
		"problem_class": "none",
		"baseline": map[string]any{
			"approach": "Direct design", "components": []any{}, "decisions": []any{},
			"rejected_alternatives": []any{}, "complexity_justification": []any{}, "risks": []any{},
		},
		"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
	}
	tasksWithoutRevision := map[string]any{
		"problem_class": "none",
		"baseline":      map[string]any{"work_items": []any{workItemInput("work", []any{0})}},
		"findings":      []any{}, "changed_paths": []any{}, "no_file_changes": true,
	}
	implementationWithoutRevision := map[string]any{
		"problem_class": "none", "completed_work_item_ids": []any{}, "changed_paths": []any{},
		"no_file_changes": true, "deviations": []any{}, "findings": []any{},
	}
	for _, tc := range []struct {
		kind       domain.ActionKind
		nodeResult map[string]any
		revision   string
	}{
		{domain.ActionCompleteDesign, designWithoutRevision, "requirements_revision"},
		{domain.ActionCompleteTasks, tasksWithoutRevision, "design_revision"},
		{domain.ActionCompleteImplementation, implementationWithoutRevision, "task_plan_revision"},
	} {
		t.Run(string(tc.kind), func(t *testing.T) {
			schema, err := SubmissionNodeResultSchema(tc.kind)
			if err != nil {
				t.Fatal(err)
			}
			if schemaRequires(schema, tc.revision) {
				t.Fatalf("the submission schema still requires %s", tc.revision)
			}
			if !schemaDeclaresProperty(schema, tc.revision) {
				t.Fatalf("the submission schema dropped the %s property", tc.revision)
			}
			raw, err := json.Marshal(tc.nodeResult)
			if err != nil {
				t.Fatal(err)
			}
			if err := ValidateSubmissionNodeResult(tc.kind, raw); err != nil {
				t.Fatalf("a submission without the system-state revision was refused: %v", err)
			}
		})
	}
	t.Run("Delivery authority belongs only to Core", func(t *testing.T) {
		schema, err := SubmissionNodeResultSchema(domain.ActionCompleteDelivery)
		if err != nil {
			t.Fatal(err)
		}
		for _, member := range []string{"acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id"} {
			if schemaRequires(schema, member) || schemaDeclaresProperty(schema, member) {
				t.Fatalf("Delivery submission still exposes %s", member)
			}
		}
		minimal := map[string]any{
			"problem_class": "none", "unverified_items": []any{}, "risks": []any{}, "findings": []any{},
			"changed_paths": []any{}, "no_file_changes": true,
		}
		raw, marshalErr := json.Marshal(minimal)
		if marshalErr != nil {
			t.Fatal(marshalErr)
		}
		if err := ValidateSubmissionNodeResult(domain.ActionCompleteDelivery, raw); err != nil {
			t.Fatalf("minimal Delivery submission was refused: %v", err)
		}
		minimal["acceptance"] = []any{}
		raw, _ = json.Marshal(minimal)
		err = ValidateSubmissionNodeResult(domain.ActionCompleteDelivery, raw)
		typed, ok := err.(*domain.Error)
		if !ok || len(typed.Violations) != 1 || typed.Violations[0].Path != "node_result.acceptance" || typed.Violations[0].Rule != domain.RuleUnknownMember {
			t.Fatalf("removed Delivery member error=%v", err)
		}
	})
	t.Run("older clients keep sending the current value", func(t *testing.T) {
		withRevision := map[string]any{
			"problem_class": "none",
			"baseline": map[string]any{
				"requirements_revision": 3, "approach": "Direct design", "components": []any{}, "decisions": []any{},
				"rejected_alternatives": []any{}, "complexity_justification": []any{}, "risks": []any{},
			},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		}
		raw, err := json.Marshal(withRevision)
		if err != nil {
			t.Fatal(err)
		}
		if err := ValidateSubmissionNodeResult(domain.ActionCompleteDesign, raw); err != nil {
			t.Fatalf("the older-client shape was refused: %v", err)
		}
	})
	t.Run("model-owned members keep exact paths", func(t *testing.T) {
		missingApproach := map[string]any{
			"problem_class": "none",
			"baseline": map[string]any{
				"components": []any{}, "decisions": []any{}, "rejected_alternatives": []any{},
				"complexity_justification": []any{}, "risks": []any{},
			},
			"findings": []any{}, "changed_paths": []any{}, "no_file_changes": true,
		}
		raw, err := json.Marshal(missingApproach)
		if err != nil {
			t.Fatal(err)
		}
		err = ValidateSubmissionNodeResult(domain.ActionCompleteDesign, raw)
		typed, ok := err.(*domain.Error)
		if !ok || !typed.ZeroWrite || len(typed.Violations) != 1 ||
			typed.Violations[0].Path != "node_result.baseline.approach" || typed.Violations[0].Rule != domain.RuleRequiredMemberMissing {
			t.Fatalf("failure=%v want one zero-write violation at node_result.baseline.approach", err)
		}
	})
	t.Run("nested array member keeps its index", func(t *testing.T) {
		missingVerification := map[string]any{
			"problem_class": "none",
			"baseline":      map[string]any{"work_items": []any{workItemWithoutVerificationSteps("work", []any{0})}},
			"findings":      []any{}, "changed_paths": []any{}, "no_file_changes": true,
		}
		raw, err := json.Marshal(missingVerification)
		if err != nil {
			t.Fatal(err)
		}
		err = ValidateSubmissionNodeResult(domain.ActionCompleteTasks, raw)
		typed, ok := err.(*domain.Error)
		if !ok || !typed.ZeroWrite || len(typed.Violations) != 1 ||
			typed.Violations[0].Path != "node_result.baseline.work_items[0].verification_steps" {
			t.Fatalf("failure=%v want one violation at node_result.baseline.work_items[0].verification_steps", err)
		}
	})
	t.Run("nullable baseline stays optional", func(t *testing.T) {
		raw := []byte(`{"problem_class":"requirement_gap","baseline":null,"findings":["Acceptance is unclear"],"changed_paths":[],"no_file_changes":true}`)
		if err := ValidateSubmissionNodeResult(domain.ActionCompleteDesign, raw); err != nil {
			t.Fatalf("a null baseline was refused: %v", err)
		}
	})
	t.Run("unknown action kind is refused", func(t *testing.T) {
		if _, err := SubmissionNodeResultSchema(domain.ActionResolveBlocker); err == nil {
			t.Fatal("the blocker kind exposed a node submission schema")
		}
	})
}
