package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// applyTestPayload submits one TEST payload and returns the failure so a test can
// inspect its structured detail.
func applyTestPayload(t *testing.T, s *Service, task domain.ProcessTask, requestID, transition, reason string, nodeResult any) error {
	t.Helper()
	raw := phase5Payload(t, task, transition, reason, nodeResult)
	action := task.CurrentAction
	_, err := s.ApplyAction(context.Background(), ApplyActionRequest{RequestID: domain.ID(requestID), Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: raw})
	return err
}

func structuredFailure(t *testing.T, err error) *domain.Error {
	t.Helper()
	var typed *domain.Error
	if !errors.As(err, &typed) || typed == nil {
		t.Fatalf("failure is not a structured domain error: %v", err)
	}
	return typed
}

// TestApplyInvalidArgumentUserEvidenceIsZeroWriteAndCorrectable reproduces the
// reported rejection: a completed user verification submitted with one command.
func TestApplyInvalidArgumentUserEvidenceIsZeroWriteAndCorrectable(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	before, revision := memory.commits, task.Revision
	checks := []map[string]any{
		evidenceCheck("automated", "passed", "targeted-workflow", 1, false),
		evidenceCheck("automated", "passed", "targeted-application", 1, false),
		evidenceCheck("automated", "passed", "targeted-mcp", 1, false),
		evidenceCheck("user", "passed", "manual-manager-check", 1, false),
	}
	err := applyTestPayload(t, service, task, "apply-user-evidence", "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	if !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("error=%v", err)
	}
	typed := structuredFailure(t, err)
	if !typed.ZeroWrite {
		t.Fatal("a pre-mutation contract failure must carry the zero-write proof")
	}
	if len(typed.Violations) != 1 {
		t.Fatalf("violations=%#v", typed.Violations)
	}
	violation := typed.Violations[0]
	if violation.Path != "payload.node_result.checks[3].command_count" || violation.Rule != domain.RuleNonAutomatedCommandCountZero {
		t.Fatalf("violation=%#v", violation)
	}
	if memory.commits != before {
		t.Fatal("a rejected request wrote state")
	}
	current, loadErr := memory.LoadTask(context.Background(), task.TaskID)
	if loadErr != nil || current.Revision != revision {
		t.Fatalf("revision=%d want=%d err=%v", current.Revision, revision, loadErr)
	}

	// Core authorizes the deterministic member correction. The Host retains the
	// original request and enforces that no other member changes; Core does not
	// persist or compare rejected payloads.
	if paths := domain.ViolationPaths(err); len(paths) != 1 || paths[0] != violation.Path {
		t.Fatalf("allowed paths=%v", paths)
	}
	checks[3] = evidenceCheck("user", "passed", "manual-manager-check", 0, false)
	checks[3]["summary"] = "A semantically valid summary that demonstrates Host-owned comparison."
	if err := applyTestPayload(t, service, task, "apply-user-evidence-corrected", "tests_passed", "", testNodeResult(checks, nil, nil, nil)); err != nil {
		t.Fatalf("the bounded correction was rejected: %v", err)
	}
	if memory.commits != before+1 {
		t.Fatalf("commits=%d want=%d", memory.commits, before+1)
	}
}

// TestApplyDeliveryMissingComprehensionEvidenceIsZeroWriteAndCorrectable covers
// the reported DELIVERY failure. Core exposes the exact current evidence-set
// member before an ActionCommit is staged, so the Host can copy the retained
// user evidence ID and resubmit the same Action once.
func TestApplyDeliveryMissingComprehensionEvidenceIsZeroWriteAndCorrectable(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtDelivery(t, service)
	before := memory.commits
	result := deliveryCompleteNodeResult(task)
	result["manual_evidence_ids"] = []string{}
	err := applyTestPayload(t, service, task, "delivery-missing-comprehension", "delivery_complete", "", result)
	if !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("error=%v", err)
	}
	typed := structuredFailure(t, err)
	if !typed.ZeroWrite || memory.commits != before {
		t.Fatalf("zero write=%v commits=%d", typed.ZeroWrite, memory.commits-before)
	}
	paths := domain.ViolationPaths(err)
	if len(paths) != 1 || paths[0] != "payload.node_result.manual_evidence_ids" || typed.Guard == nil || typed.Guard.Failures[0].Rule != domain.ViolationRule(domain.GuardCurrentSetRequired) {
		t.Fatalf("paths=%v guard=%#v", paths, typed.Guard)
	}
	result["manual_evidence_ids"] = []string{string(task.Comprehension.UserEvidenceID)}
	if err := applyTestPayload(t, service, task, "delivery-corrected-comprehension", "delivery_complete", "", result); err != nil {
		t.Fatalf("corrected delivery failed: %v", err)
	}
}

// TestApplyInvalidArgumentPartialCorrectionRemainsInvalid proves that leaving
// one reported failure unresolved does not commit state. It does not claim that
// Core compares the corrected request with the rejected payload.
func TestApplyInvalidArgumentPartialCorrectionRemainsInvalid(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	before := memory.commits
	checks := []map[string]any{evidenceCheck("user", "passed", "manual-check", 1, true)}
	err := applyTestPayload(t, service, task, "apply-unauthorized", "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	typed := structuredFailure(t, err)
	paths := domain.ViolationPaths(err)
	if len(paths) != 2 || paths[0] != "payload.node_result.checks[0].command_count" || paths[1] != "payload.node_result.checks[0].full_suite" {
		t.Fatalf("allowed paths=%v violations=%#v", paths, typed.Violations)
	}
	// Correcting only one of the two listed members keeps the request invalid.
	checks[0] = evidenceCheck("user", "passed", "manual-check", 0, true)
	second := applyTestPayload(t, service, task, "apply-unauthorized-second", "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	secondTyped := structuredFailure(t, second)
	if len(secondTyped.Violations) != 1 || secondTyped.Violations[0].Rule != domain.RuleNonAutomatedFullSuiteFalse {
		t.Fatalf("second violations=%#v", secondTyped.Violations)
	}
	if memory.commits != before {
		t.Fatal("a rejected request wrote state")
	}
}

// TestApplyTransitionNotAllowedCarriesGuardFailureAndZeroWrite covers the
// implementation forward guard.
func TestApplyTransitionNotAllowedCarriesGuardFailureAndZeroWrite(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtImplement(t, service)
	before := memory.commits
	result := implementationNodeResult(1, []string{"work-a"}, true, []string{"An unresolved design gap"})
	err := applyTestPayload(t, service, task, "apply-forward-findings", "implementation_ready_for_test", "", result)
	if !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("error=%v", err)
	}
	typed := structuredFailure(t, err)
	if typed.Guard == nil || typed.Guard.GuardID != "implementation_report_complete" {
		t.Fatalf("guard=%#v", typed.Guard)
	}
	if len(typed.Guard.Failures) != 1 {
		t.Fatalf("guard failures=%#v", typed.Guard.Failures)
	}
	failure := typed.Guard.Failures[0]
	if failure.Path != "payload.node_result.findings" || failure.Rule != domain.ViolationRule(domain.GuardForwardFindingsEmpty) {
		t.Fatalf("guard failure=%#v", failure)
	}
	if !typed.ZeroWrite || memory.commits != before {
		t.Fatalf("zero write=%v commits=%d", typed.ZeroWrite, memory.commits-before)
	}
}

// TestApplyImplementationDeviationsDoNotBlockForwardTransition keeps the current
// semantics: recorded deviations are retained, not a guard failure, and
// completed_work_item_ids need not cover every work item.
func TestApplyDeviationsAreNotTransitionNotAllowed(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtImplement(t, service)
	result := implementationNodeResult(1, []string{"work-a"}, true, nil)
	result["deviations"] = []string{"Renamed one helper for readability"}
	next := applyPhase5(t, service, task, "implementation_ready_for_test", "", result)
	if next.CurrentNode != domain.NodeTest {
		t.Fatalf("current node=%s", next.CurrentNode)
	}
	if next.Implementation == nil || len(next.Implementation.Deviations) != 1 {
		t.Fatalf("implementation record=%#v", next.Implementation)
	}
}

// TestApplyManualHandoffKeepsOnlyOutstandingWork proves a completed user
// verification belongs in checks while manual_handoff_items keeps only work
// nobody has run yet.
func TestApplyUserEvidenceAndManualHandoffSeparation(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	checks := []map[string]any{
		evidenceCheck("automated", "passed", "targeted-suite", 1, false),
		evidenceCheck("user", "passed", "manual-manager-check", 0, false),
	}
	result := testNodeResult(checks, nil, nil, nil)
	next := applyPhase5(t, service, task, "tests_passed", "", result)
	if next.CurrentNode != domain.NodeComprehensionReview {
		t.Fatalf("current node=%s", next.CurrentNode)
	}
	if next.Test == nil || len(next.Test.ManualHandoffItems) != 0 {
		t.Fatalf("test record manual handoff=%#v", next.Test)
	}
	sources := map[domain.EvidenceSource]int{}
	for _, item := range next.Evidence {
		sources[item.Source]++
	}
	if sources[domain.EvidenceSourceUser] != 1 || sources[domain.EvidenceSourceAutomated] != 1 {
		t.Fatalf("retained evidence sources=%#v", sources)
	}
}

// TestApplyUncertainRecoveryFailureKeepsNoCorrection proves the recovery route
// never claims a zero-write proof, because a lost or truncated response cannot
// prove the original mutation did not commit.
func TestApplyRecoveryFailureKeepsZeroWriteProofUnset(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	before := memory.commits
	checks := []map[string]any{evidenceCheck("user", "passed", "manual-check", 1, false)}
	raw := phase5Payload(t, task, "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	action := task.CurrentAction
	request := ApplyActionRequest{RequestID: "apply-recovery", Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: raw, RecoveryApply: &RecoveryApplyInput{OperationID: "apply-recovery", SourceCursor: task.CurrentNode}}
	_, err := service.ApplyAction(context.Background(), request)
	if err == nil {
		t.Fatal("an invalid recovery payload was accepted")
	}
	var typed *domain.Error
	if errors.As(err, &typed) && typed != nil && typed.ZeroWrite {
		t.Fatal("the recovery route must not claim a zero-write proof")
	}
	if memory.commits != before {
		t.Fatal("a rejected recovery request wrote state")
	}
}

// TestApplyInvalidArgumentDetailCarriesNoSubmittedData is the redaction gate for
// the structured detail produced inside the application boundary.
func TestApplyInvalidArgumentDetailCarriesNoSubmittedData(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	secret := "/Users/private/secret.db"
	checks := []map[string]any{{"source": "user", "name": secret, "status": "passed", "summary": secret, "command_count": 3, "full_suite": true}}
	err := applyTestPayload(t, service, task, "apply-redaction", "tests_passed", "", testNodeResult(checks, nil, nil, nil))
	typed := structuredFailure(t, err)
	encoded, marshalErr := json.Marshal(typed.Violations)
	if marshalErr != nil {
		t.Fatal(marshalErr)
	}
	if len(typed.Violations) == 0 {
		t.Fatal("no structured detail was produced")
	}
	for _, forbidden := range []string{secret, "/Users/", "secret.db", "sqlite", "SELECT "} {
		if containsFold(string(encoded), forbidden) {
			t.Fatalf("structured detail leaked %q: %s", forbidden, encoded)
		}
	}
}

func containsFold(text, needle string) bool {
	return len(needle) != 0 && len(text) >= len(needle) && indexFold(text, needle) >= 0
}
func indexFold(text, needle string) int {
	lower := func(value byte) byte {
		if value >= 'A' && value <= 'Z' {
			return value + 32
		}
		return value
	}
	for start := 0; start+len(needle) <= len(text); start++ {
		match := true
		for offset := 0; offset < len(needle); offset++ {
			if lower(text[start+offset]) != lower(needle[offset]) {
				match = false
				break
			}
		}
		if match {
			return start
		}
	}
	return -1
}
