package application

import (
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
	drift.WorktreeFingerprint, drift.BindingDigest = digestOf("c"), digestOf("d")
	observer.binding = drift
	assertApplyFails(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "targeted", 1, false)}, nil, nil, nil), domain.ErrRepositoryDrift)
	if ms.commits != before {
		t.Fatal("test repository drift wrote state")
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
	record.RepositoryBindingDigest = digestOf("f")
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
	changed := observer.binding.Clone()
	changed.WorktreeFingerprint = digestOf("c")
	changed.BindingDigest = digestOf("d")
	observer.binding = changed
	result := applyPhase5(t, s, task, "refactor_ready_for_test", "", refactorNodeResult([]string{"internal/file.go"}, false, []string{"Removed indirection"}, false, nil))
	if result.CurrentNode != domain.NodeTest || result.Test != nil || result.Comprehension != nil || result.Implementation == nil || result.Implementation.Revision != 2 || result.Repository.BindingDigest != changed.BindingDigest {
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
				record.RepositoryBindingDigest = digestOf("f")
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
	for name, mutate := range map[string]func(*domain.RepositoryBinding){
		"branch": func(binding *domain.RepositoryBinding) { branch := "other"; binding.Branch = &branch },
		"head": func(binding *domain.RepositoryBinding) {
			head := "cccccccccccccccccccccccccccccccccccccccc"
			binding.Head = &head
		},
		"identity":         func(binding *domain.RepositoryBinding) { binding.RepositoryIdentity = digestOf("f") },
		"common directory": func(binding *domain.RepositoryBinding) { binding.GitCommonDirDigest = digestOf("f") },
	} {
		t.Run(name+" drift", func(t *testing.T) {
			s, ms, observer := phase5Service(t)
			task := phase5TaskAtRefactor(t, s)
			drift := observer.binding.Clone()
			mutate(&drift)
			drift.BindingDigest = digestOf("e")
			observer.binding = drift
			before := ms.commits
			assertApplyFails(t, s, task, "refactor_ready_for_test", "", refactorNodeResult([]string{"internal/file.go"}, false, []string{"Removed indirection"}, false, nil), domain.ErrRepositoryDrift)
			if ms.commits != before {
				t.Fatal("repository drift wrote refactor state")
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
	return map[string]any{"source": source, "name": name, "status": status, "summary": "Evidence summary.", "command_count": commands, "full_suite": full}
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
	return map[string]any{"checks": checks, "failed_items": failed, "unverified_items": unverified, "manual_handoff_items": []string{}, "findings": findings}
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
	return map[string]any{"changed_paths": paths, "no_file_changes": noChanges, "simplifications": simplifications, "behavior_change_intended": behavior, "findings": findings}
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
	clone.ChangedPaths = append([]string(nil), record.ChangedPaths...)
	clone.Deviations = append([]string(nil), record.Deviations...)
	return &clone
}
