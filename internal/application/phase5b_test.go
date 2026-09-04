package application

import (
	"context"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestTestTransitionsEvidenceBudgetAndRecord(t *testing.T) {
	for _, tc := range []struct {
		transition  string
		destination domain.NodeID
	}{
		{"tests_failed_implementation", domain.NodeImplement},
		{"tests_expose_design_issue", domain.NodeDesign},
		{"tests_expose_requirement_issue", domain.NodeRequirements},
	} {
		t.Run(tc.transition, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtTest(t, s)
			result := applyPhase5(t, s, task, tc.transition, "Failure classified.", testNodeResult([]map[string]any{evidenceCheck("automated", "failed", "failed-check", 1, false)}, []string{"failed item"}, nil, []string{"classified failure"}))
			if result.CurrentNode != tc.destination || result.Test != nil || len(result.Evidence) != 1 {
				t.Fatal("failed test transition did not retain failure evidence or invalidate current test")
			}
			if ms.lastMutation.Event.TransitionReason == "" {
				t.Fatal("failure reason was not recorded")
			}
		})
	}

	s, _, _ := phase5Service(t)
	task := phase5TaskAtTest(t, s)
	passed := applyPhase5(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted-test", 1, false)}, nil, nil, nil))
	if passed.CurrentNode != domain.NodeComprehensionReview || passed.Test == nil || len(passed.Test.EvidenceIDs) != 1 || len(passed.Evidence) != 1 || passed.Evidence[0].EvidenceID == "" || passed.Evidence[0].Digest == passed.Process.DefinitionDigest || !passed.Evidence[0].RecordedAt.Equal(passed.Test.PassedAt) {
		t.Fatal("tests_passed did not create current Core-owned evidence and TestRecord")
	}

	invalid := []struct {
		name   string
		result map[string]any
		want   error
	}{
		{"budget exceeded", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "too-many", 5, false)}, nil, nil, nil), domain.ErrVerificationBudgetExceeded},
		{"full suite unauthorized", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "full", 1, true)}, nil, nil, nil), domain.ErrVerificationBudgetExceeded},
		{"invalid source", testNodeResult([]map[string]any{evidenceCheck("other", "passed", "bad-source", 0, false)}, nil, nil, nil), domain.ErrInvalidArgument},
		{"invalid status", testNodeResult([]map[string]any{evidenceCheck("automated", "other", "bad-status", 1, false)}, nil, nil, nil), domain.ErrInvalidArgument},
		{"non-automated command", testNodeResult([]map[string]any{evidenceCheck("static", "passed", "bad-command", 1, false)}, nil, nil, nil), domain.ErrInvalidArgument},
		{"duplicate name", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "duplicate", 1, false), evidenceCheck("static", "passed", "duplicate", 0, false)}, nil, nil, nil), domain.ErrInvalidArgument},
		{"pass guard failed", testNodeResult([]map[string]any{evidenceCheck("automated", "failed", "failed", 1, false)}, nil, nil, nil), domain.ErrTransitionNotAllowed},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtTest(t, s)
			before := ms.commits
			assertApplyFails(t, s, task, "tests_passed", "", tc.result, tc.want)
			if ms.commits != before {
				t.Fatal("rejected test wrote state")
			}
		})
	}
}

func TestVerificationBudgetIncreaseStaysInTestAndRecordsSpecificReason(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtTest(t, s)
	adjustment := map[string]any{
		"basis": "new_impact", "additional_checks": []map[string]any{{"name": "indirect-consumer-test", "rationale": "A newly found caller shares the changed contract."}},
		"additional_automatic_commands": 2, "allow_full_suite": false, "allow_manual_handoff": false,
	}
	result := applyPhase5(t, s, task, "verification_budget_increased", "A newly found indirect caller requires one focused regression command and one rerun after any fix.", budgetAdjustmentNodeResult(adjustment))
	budget, ok := result.CurrentVerificationBudget()
	if !ok || result.CurrentNode != domain.NodeTest || result.CurrentAction == nil || budget.MaxAutomaticCommands != 6 || len(result.VerificationBudgetAdjustments) != 1 || len(result.Evidence) != 0 || len(result.VerificationAttempts) != 0 {
		t.Fatalf("adjusted task=%#v budget=%#v", result.VerificationBudgetAdjustments, budget)
	}
	if result.VerificationBudgetAdjustments[0].Reason == "" || ms.lastMutation.Event.TransitionReason == "" {
		t.Fatal("budget increase reason was not retained")
	}

	s, ms, _ = phase5Service(t)
	task = phase5TaskAtTest(t, s)
	before := ms.commits
	assertApplyFails(t, s, task, "verification_budget_increased", "", budgetAdjustmentNodeResult(adjustment), domain.ErrInvalidArgument)
	if ms.commits != before {
		t.Fatal("reasonless budget increase wrote state")
	}
}

func TestTestRejectsStaleAuthorityAndRepository(t *testing.T) {
	s, ms, observer := phase5Service(t)
	task := phase5TaskAtTest(t, s)
	stale := task
	stale.Implementation = cloneImplementationRecord(task.Implementation)
	stale.Implementation.TaskPlanRevision++
	ms.task = &stale
	before := ms.commits
	assertApplyFails(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted", 1, false)}, nil, nil, nil), domain.ErrStorageUnavailable)
	if ms.commits != before {
		t.Fatal("stale test authority wrote state")
	}
	ms.task = &task
	drift := observer.binding.Clone()
	drift = phase5BindingWithSurface(drift, []string{"internal/file.go"}, "c")
	observer.binding = drift
	updated, err := applyPhase5Result(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted", 1, false)}, nil, nil, nil))
	if err != nil || updated.CurrentNode != domain.NodeImplement || updated.Implementation != nil || ms.commits != before+1 {
		t.Fatalf("stale implementation content was not invalidated: node=%s commits=%d err=%v", updated.CurrentNode, ms.commits-before, err)
	}
}

func TestTestRejectsLegacyRepositoryEffectMembers(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtTest(t, s)
	for _, member := range []string{"changed_paths", "no_file_changes"} {
		result := testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted", 1, false)}, nil, nil, nil)
		if member == "changed_paths" {
			result[member] = []string{}
		} else {
			result[member] = true
		}
		before := ms.commits
		raw := phase5Payload(t, task, "tests_passed", "", result)
		_, err := s.ApplyAction(context.Background(), currentActionApplyRequest(task, domain.ID("apply-legacy-"+member), raw))
		typed, ok := err.(*domain.Error)
		if !ok || typed.Code != domain.ErrorInvalidArgument || !typed.ZeroWrite || len(typed.Violations) != 1 || typed.Violations[0].Rule != domain.RuleUnknownMember || typed.Violations[0].Path != "payload.node_result."+member || ms.commits != before {
			t.Fatalf("legacy %s error=%#v", member, err)
		}
	}
}

func TestComprehensionPassRequiresExplicitUserEvidence(t *testing.T) {
	s, _, _ := phase5Service(t)
	task := phase5TaskAtComprehension(t, s)
	passed := applyPhase5(t, s, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
	if passed.CurrentNode != domain.NodeDelivery || passed.Comprehension == nil {
		t.Fatal("comprehension pass did not enter delivery")
	}
	userEvidence := evidenceByID(passed, passed.Comprehension.UserEvidenceID)
	if userEvidence == nil || userEvidence.Source != domain.EvidenceSourceUser || userEvidence.Status != domain.EvidencePassed || !userEvidence.RecordedAt.Equal(passed.Comprehension.ConfirmedAt) {
		t.Fatal("user confirmation was not Core-owned and current")
	}

	invalid := []struct {
		name, source, status                string
		explained, unresolved, abstractions []string
	}{
		{"missing confirmation", "", "", []string{"component"}, nil, nil},
		{"automated confirmation", "automated", "passed", []string{"component"}, nil, nil},
		{"static confirmation", "static", "passed", []string{"component"}, nil, nil},
		{"host confirmation", "host_observed", "passed", []string{"component"}, nil, nil},
		{"unresolved question", "user", "passed", []string{"component"}, []string{"question"}, nil},
		{"unnecessary abstraction", "user", "passed", []string{"component"}, nil, []string{"factory"}},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtComprehension(t, s)
			before := ms.commits
			assertApplyFails(t, s, task, "comprehension_passed", "", comprehensionNodeResult(tc.explained, tc.unresolved, tc.abstractions, tc.source, tc.status, nil), domain.ErrTransitionNotAllowed)
			if ms.commits != before {
				t.Fatal("rejected comprehension wrote state")
			}
		})
	}
}

func TestComprehensionRemediationTransitions(t *testing.T) {
	for _, tc := range []struct {
		transition                         string
		destination                        domain.NodeID
		unresolved, abstractions, findings []string
	}{
		{"implementation_defect", domain.NodeImplement, nil, nil, []string{"defect"}},
		{"code_too_complex", domain.NodeRefactor, nil, []string{"factory"}, []string{"Code complexity"}},
		{"design_too_complex", domain.NodeDesign, nil, []string{"layers"}, []string{"Design complexity"}},
		{"evidence_insufficient", domain.NodeTest, []string{"coverage unknown"}, nil, []string{"Verification gap"}},
		{"requirement_unclear", domain.NodeRequirements, []string{"behavior unclear"}, nil, []string{"Requirement gap"}},
	} {
		t.Run(tc.transition, func(t *testing.T) {
			s, _, _ := phase5Service(t)
			task := phase5TaskAtComprehension(t, s)
			result := applyPhase5(t, s, task, tc.transition, "Remediation required.", comprehensionNodeResult(nil, tc.unresolved, tc.abstractions, "", "", tc.findings))
			if result.CurrentNode != tc.destination || result.Comprehension != nil {
				t.Fatal("comprehension remediation destination/invalidation mismatch")
			}
		})
	}
}

func TestComprehensionRejectsStaleTestRecord(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtComprehension(t, s)
	stale := task
	record := *task.Test
	record.ContentDigest = digestOf("f")
	stale.Test = &record
	ms.task = &stale
	before := ms.commits
	assertApplyFails(t, s, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil), domain.ErrStorageUnavailable)
	if ms.commits != before {
		t.Fatal("stale test record wrote comprehension state")
	}
}

func TestRefactorTransitionsRepositoryEffectsAndGuards(t *testing.T) {
	s, ms, observer := phase5Service(t)
	task := phase5TaskAtRefactor(t, s)
	changed := phase5BindingWithSurface(observer.binding.Clone(), []string{"internal/file.go"}, "c")
	observer.binding = changed
	result := applyPhase5(t, s, task, "refactor_ready_for_test", "", refactorNodeResult(nil, false, []string{"Removed indirection"}, false, nil))
	if result.CurrentNode != domain.NodeTest || result.Test != nil || result.Comprehension != nil || result.Implementation == nil || result.Implementation.Revision != 2 || result.Repository.BindingDigest != changed.BindingDigest || result.Implementation.ContentDigest != changed.ContentDigest || len(result.Implementation.ActionChangedPaths) != 1 || result.Implementation.ActionChangedPaths[0] != "internal/file.go" {
		t.Fatal("refactor did not update implementation, binding, invalidation, and mandatory TEST return")
	}

	s, ms, _ = phase5Service(t)
	task = phase5TaskAtRefactor(t, s)
	for name, node := range map[string]map[string]any{
		"behavior change":        refactorNodeResult(nil, true, []string{"Changed behavior"}, true, nil),
		"missing simplification": refactorNodeResult(nil, true, nil, false, nil),
	} {
		t.Run(name, func(t *testing.T) {
			before := ms.commits
			assertApplyFails(t, s, task, "refactor_ready_for_test", "", node, domain.ErrTransitionNotAllowed)
			if ms.commits != before {
				t.Fatal("rejected refactor wrote state")
			}
		})
	}
	assertApplyFails(t, s, task, "delivery_complete", "", refactorNodeResult(nil, true, []string{"x"}, false, nil), domain.ErrTransitionNotAllowed)
	for _, tc := range []struct {
		transition  string
		destination domain.NodeID
	}{{"refactor_requires_design", domain.NodeDesign}, {"refactor_requires_requirements", domain.NodeRequirements}} {
		t.Run(tc.transition, func(t *testing.T) {
			s, _, _ := phase5Service(t)
			task := phase5TaskAtRefactor(t, s)
			result := applyPhase5(t, s, task, tc.transition, "Upstream change required.", refactorNodeResult(nil, true, nil, true, []string{"upstream change"}))
			if result.CurrentNode != tc.destination {
				t.Fatal("refactor remediation destination mismatch")
			}
		})
	}
}

func TestDeliveryCompleteValidatesAuthoritiesEvidenceAndReleasesClaim(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtDelivery(t, s)
	result := applyPhase5(t, s, task, "delivery_complete", "", deliveryCompleteNodeResult(task))
	if result.CurrentNode != domain.NodeDone || result.CurrentAction != nil || result.Outcome == nil || result.CompletedAt == nil || result.Outcome.Status != domain.TerminalCompleted || ms.lastMutation.Claim != store.ClaimRelease {
		t.Fatal("delivery did not create terminal outcome and release claim")
	}
	if len(result.Evidence) != len(task.Evidence) || len(result.BaselineHistory) != len(task.BaselineHistory) {
		t.Fatal("delivery deleted retained authority")
	}

	s, ms, _ = phase5Service(t)
	task = phase5TaskAtDelivery(t, s)
	invalid := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{"wrong test record", func(v map[string]any) { v["test_record_id"] = "wrong-test" }},
		{"wrong comprehension record", func(v map[string]any) { v["comprehension_record_id"] = "wrong-review" }},
		{"missing evidence", func(v map[string]any) { v["automated_evidence_ids"] = []string{"missing-evidence"} }},
		{"wrong evidence source", func(v map[string]any) {
			v["automated_evidence_ids"] = []string{string(task.Comprehension.UserEvidenceID)}
		}},
		{"duplicate evidence", func(v map[string]any) {
			id := string(task.Comprehension.UserEvidenceID)
			v["automated_evidence_ids"], v["manual_evidence_ids"] = []string{id}, []string{id}
		}},
		{"acceptance count", func(v map[string]any) { v["acceptance"] = []any{} }},
		{"acceptance text", func(v map[string]any) {
			v["acceptance"] = []map[string]any{{"criterion": "wrong", "status": "satisfied"}}
		}},
		{"unverified", func(v map[string]any) { v["unverified_items"] = []string{"remaining"} }},
	}
	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			node := deliveryCompleteNodeResult(task)
			tc.mutate(node)
			before := ms.commits
			assertApplyFails(t, s, task, "delivery_complete", "", node, domain.ErrTransitionNotAllowed)
			if ms.commits != before {
				t.Fatal("rejected delivery wrote state")
			}
		})
	}
}

func TestDeliveryRejectsStaleCurrentRecords(t *testing.T) {
	for _, target := range []string{"test", "comprehension"} {
		t.Run(target, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtDelivery(t, s)
			stale := task
			if target == "test" {
				record := *task.Test
				record.TaskPlanRevision++
				stale.Test = &record
			} else {
				record := *task.Comprehension
				record.ContentDigest = digestOf("f")
				stale.Comprehension = &record
			}
			ms.task = &stale
			before := ms.commits
			assertApplyFails(t, s, task, "delivery_complete", "", deliveryCompleteNodeResult(task), domain.ErrStorageUnavailable)
			if ms.commits != before {
				t.Fatal("stale delivery authority wrote state")
			}
		})
	}
}

func TestDeliveryRejectsCurrentTestUnverifiedItems(t *testing.T) {
	s, ms, _ := phase5Service(t)
	task := phase5TaskAtTest(t, s)
	task = applyPhase5(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted-test", 1, false)}, nil, []string{"manual verification remains"}, nil))
	task = applyPhase5(t, s, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
	before := ms.commits
	assertApplyFails(t, s, task, "delivery_complete", "", deliveryCompleteNodeResult(task), domain.ErrTransitionNotAllowed)
	if ms.commits != before {
		t.Fatal("unverified current test reached delivery")
	}
}

func TestDeliveryRemediationTransitionsRetainClaim(t *testing.T) {
	for _, tc := range []struct {
		transition  string
		destination domain.NodeID
	}{
		{"delivery_needs_implementation", domain.NodeImplement}, {"delivery_needs_test", domain.NodeTest}, {"delivery_needs_comprehension", domain.NodeComprehensionReview}, {"delivery_needs_design", domain.NodeDesign}, {"delivery_needs_requirements", domain.NodeRequirements},
	} {
		t.Run(tc.transition, func(t *testing.T) {
			s, ms, _ := phase5Service(t)
			task := phase5TaskAtDelivery(t, s)
			result := applyPhase5(t, s, task, tc.transition, "Remediation required.", deliveryRemediationNodeResult())
			if result.CurrentNode != tc.destination || result.Outcome != nil || ms.lastMutation.Claim != store.ClaimRetain {
				t.Fatal("delivery remediation released claim or created outcome")
			}
		})
	}
}

func phase5TaskAtTest(t *testing.T, s *Service) domain.ProcessTask {
	task := phase5TaskAtImplement(t, s)
	return applyPhase5(t, s, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"work-a"}, true, nil))
}
func phase5TaskAtComprehension(t *testing.T, s *Service) domain.ProcessTask {
	task := phase5TaskAtTest(t, s)
	return applyPhase5(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted-test", 1, false)}, nil, nil, nil))
}
func phase5TaskAtRefactor(t *testing.T, s *Service) domain.ProcessTask {
	task := phase5TaskAtComprehension(t, s)
	return applyPhase5(t, s, task, "code_too_complex", "Code is too complex.", comprehensionNodeResult(nil, nil, []string{"factory"}, "", "", []string{"Code complexity"}))
}
func phase5TaskAtDelivery(t *testing.T, s *Service) domain.ProcessTask {
	task := phase5TaskAtComprehension(t, s)
	return applyPhase5(t, s, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
}
func evidenceCheck(source, status, name string, commands int, full bool) map[string]any {
	reason := ""
	if full {
		reason = "The changed shared contract affects every package in the suite."
	}
	return map[string]any{"source": source, "name": name, "status": status, "summary": "Evidence summary.", "command_count": commands, "full_suite": full, "full_suite_reason": reason}
}
func testNodeResult(checks []map[string]any, failed, unverified, findings []string) map[string]any {
	if failed == nil {
		failed = []string{}
	}
	if unverified == nil {
		unverified = []string{}
	}
	if findings == nil {
		findings = []string{}
	}
	return map[string]any{"checks": checks, "failed_items": failed, "unverified_items": unverified, "manual_handoff_items": []string{}, "findings": findings, "budget_adjustment": nil}
}
func budgetAdjustmentNodeResult(adjustment map[string]any) map[string]any {
	return map[string]any{"checks": []map[string]any{}, "failed_items": []string{}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{}, "budget_adjustment": adjustment}
}
func comprehensionNodeResult(explained, unresolved, abstractions []string, source, status string, findings []string) map[string]any {
	if explained == nil {
		explained = []string{}
	}
	if unresolved == nil {
		unresolved = []string{}
	}
	if abstractions == nil {
		abstractions = []string{}
	}
	if findings == nil {
		findings = []string{}
	}
	var confirmation any
	if source != "" {
		confirmation = map[string]any{"source": source, "status": status, "summary": "Developer confirmed."}
	}
	return map[string]any{"explained_components": explained, "unresolved_questions": unresolved, "unnecessary_abstractions": abstractions, "maintenance_risks": []string{}, "user_confirmation": confirmation, "findings": findings}
}
func refactorNodeResult(paths []string, noChanges bool, simplifications []string, behavior bool, findings []string) map[string]any {
	if paths == nil {
		paths = []string{}
	}
	if simplifications == nil {
		simplifications = []string{}
	}
	if findings == nil {
		findings = []string{}
	}
	_ = paths
	_ = noChanges
	return map[string]any{"simplifications": simplifications, "behavior_change_intended": behavior, "findings": findings}
}
func deliveryCompleteNodeResult(task domain.ProcessTask) map[string]any {
	return map[string]any{"acceptance": []map[string]any{{"criterion": task.Requirements.AcceptanceCriteria[0], "status": "satisfied"}}, "automated_evidence_ids": []string{string(task.Test.EvidenceIDs[0])}, "manual_evidence_ids": []string{string(task.Comprehension.UserEvidenceID)}, "test_record_id": task.Test.RecordID, "comprehension_record_id": task.Comprehension.RecordID, "unverified_items": []string{}, "risks": []string{}, "findings": []string{}}
}
func deliveryRemediationNodeResult() map[string]any {
	return map[string]any{"acceptance": []any{}, "automated_evidence_ids": []string{}, "manual_evidence_ids": []string{}, "test_record_id": "", "comprehension_record_id": "", "unverified_items": []string{}, "risks": []string{}, "findings": []string{"gap"}}
}
func evidenceByID(task domain.ProcessTask, id domain.ID) *domain.EvidenceSummary {
	for i := range task.Evidence {
		if task.Evidence[i].EvidenceID == id {
			return &task.Evidence[i]
		}
	}
	return nil
}

func cloneImplementationRecord(record *domain.ImplementationRecord) *domain.ImplementationRecord {
	clone := *record
	clone.CompletedWorkItemIDs = append([]domain.ID(nil), record.CompletedWorkItemIDs...)
	clone.ActionChangedPaths = append([]string(nil), record.ActionChangedPaths...)
	clone.Deviations = append([]string(nil), record.Deviations...)
	return &clone
}
