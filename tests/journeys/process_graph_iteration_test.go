package journeys

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type iterationJourney struct {
	t       *testing.T
	service *application.Service
	store   *store.SQLite
	dbPath  string
	repo    string
	task    domain.ProcessTask
}

type journeyState struct {
	revision uint64
	events   int
	evidence int
	claims   int
	actionID domain.ID
}

func TestProcessGraphIterationJourney(t *testing.T) {
	j := newIterationJourney(t)
	defer j.close()

	j.apply("requirements_ready", "", requirementsJourneyResult("Current goal"))
	j.apply("design_ready", "", designJourneyResult(j.task.Requirements.Revision, "Direct design"))
	j.apply("tasks_ready", "", tasksJourneyResult(j.task.Design.Revision))

	j.writeRepository("implementation one")
	j.apply("implementation_ready_for_test", "", implementationJourneyResult(j.task.TaskPlan.Revision, []string{"feature.txt"}, nil))
	j.apply("tests_failed_implementation", "The first implementation fails its targeted check.", failedTestJourneyResult("implementation defect"))
	if j.task.Test != nil || j.task.CurrentNode != domain.NodeImplement {
		t.Fatal("failed TEST created a passing record or selected the wrong destination")
	}

	j.writeRepository("implementation fixed")
	j.apply("implementation_ready_for_test", "", implementationJourneyResult(j.task.TaskPlan.Revision, []string{"feature.txt"}, nil))
	j.apply("tests_passed", "", passedTestJourneyResult())
	firstTestID := j.task.Test.RecordID
	if j.task.CurrentNode != domain.NodeComprehensionReview {
		t.Fatal("passing TEST skipped comprehension review")
	}
	j.apply("code_too_complex", "The factory layer obscures the request path.", comprehensionJourneyResult(nil, nil, []string{"factory layer"}, "", "", []string{"Code complexity"}))
	if j.task.CurrentNode != domain.NodeRefactor || j.task.Test != nil || j.task.Comprehension != nil {
		t.Fatal("complexity remediation did not invalidate current verification")
	}
	assertTransitionAbsent(t, j.task, "delivery_complete")
	j.assertRejected(domain.ErrInvalidArgument, "delivery_complete", "", deliveryJourneyResult(j.task))

	j.writeRepository("implementation simplified")
	j.apply("refactor_ready_for_test", "", refactorJourneyResult([]string{"feature.txt"}, []string{"Removed the factory layer"}, false, nil))
	if j.task.CurrentNode != domain.NodeTest || j.task.Test != nil || j.task.Comprehension != nil {
		t.Fatal("REFACTOR did not return through a fresh TEST")
	}
	j.apply("tests_passed", "", passedTestJourneyResult())
	if j.task.Test.RecordID == firstTestID {
		t.Fatal("retest reused the stale TestRecord")
	}
	j.apply("comprehension_passed", "", comprehensionJourneyResult([]string{"request entry", "duplicate guard", "repository write"}, nil, nil, "user", "passed", nil))
	if j.task.Comprehension == nil || j.evidence(j.task.Comprehension.UserEvidenceID).Source != domain.EvidenceSourceUser {
		t.Fatal("comprehension did not retain Core-owned user evidence")
	}
	j.apply("delivery_complete", "", deliveryJourneyResult(j.task))
	if j.task.CurrentNode != domain.NodeDone || j.task.CurrentAction != nil || j.task.Outcome == nil || j.claimCount() != 0 {
		t.Fatal("delivery did not atomically reach DONE and release the claim")
	}

	terminal := j.task
	j.close()
	reopened, err := store.Open(context.Background(), j.dbPath)
	if err != nil {
		t.Fatal(err)
	}
	j.store = reopened
	loaded, err := reopened.LoadTask(context.Background(), terminal.TaskID)
	if err != nil || !reflect.DeepEqual(loaded, terminal) {
		t.Fatalf("terminal restart mismatch: %v", err)
	}
	service, err := application.NewService(reopened, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "terminal-apply", Host: domain.HostCodex, TaskID: loaded.TaskID, ExpectedRevision: loaded.Revision, ActionID: "terminal-action", ActionKind: domain.ActionCompleteDelivery, ProcessID: loaded.Process.ID, ProcessDefinitionDigest: loaded.Process.DefinitionDigest, SourceCursor: loaded.CurrentNode, RepositoryBindingDigest: loaded.Repository.BindingDigest, Payload: journeyPayload(t, loaded, "delivery_complete", "", deliveryJourneyResult(loaded))})
	if err != domain.ErrTaskTerminal {
		t.Fatalf("terminal apply error=%v", err)
	}
}

func TestManualHandoffFalseStillAllowsComprehensionJourney(t *testing.T) {
	j := newIterationJourneyWithManualHandoff(t, false)
	defer j.close()
	j.toTest()
	userTest := map[string]any{"checks": []map[string]any{{"source": "user", "name": "manual-test", "status": "passed", "summary": "User performed test.", "command_count": 0, "full_suite": false}}, "failed_items": []string{}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{}}
	j.assertRejected(domain.ErrVerificationBudgetExceeded, "tests_passed", "", userTest)
	j.apply("tests_passed", "", passedTestJourneyResult())
	j.apply("comprehension_passed", "", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "passed", nil))
	j.apply("delivery_complete", "", deliveryJourneyResult(j.task))
	if j.task.CurrentNode != domain.NodeDone || j.task.Outcome == nil || j.claimCount() != 0 {
		t.Fatal("mandatory comprehension confirmation was blocked by TEST manual-handoff budget")
	}
}

func TestProcessGraphIterationNegativeComprehension(t *testing.T) {
	tests := []struct {
		name   string
		result map[string]any
		want   error
	}{
		{"missing_user_confirmation", comprehensionJourneyResult([]string{"component"}, nil, nil, "", "", nil), domain.ErrTransitionNotAllowed},
		{"automated_source", comprehensionJourneyResult([]string{"component"}, nil, nil, "automated", "passed", nil), domain.ErrTransitionNotAllowed},
		{"static_source", comprehensionJourneyResult([]string{"component"}, nil, nil, "static", "passed", nil), domain.ErrTransitionNotAllowed},
		{"host_observed_source", comprehensionJourneyResult([]string{"component"}, nil, nil, "host_observed", "passed", nil), domain.ErrTransitionNotAllowed},
		{"status_not_passed", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "failed", nil), domain.ErrTransitionNotAllowed},
		{"explained_components_empty", comprehensionJourneyResult(nil, nil, nil, "user", "passed", nil), domain.ErrTransitionNotAllowed},
		{"unresolved_questions", comprehensionJourneyResult([]string{"component"}, []string{"question"}, nil, "user", "passed", nil), domain.ErrTransitionNotAllowed},
		{"unnecessary_abstractions", comprehensionJourneyResult([]string{"component"}, nil, []string{"factory"}, "user", "passed", nil), domain.ErrTransitionNotAllowed},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toComprehension()
			j.assertRejected(tc.want, "comprehension_passed", "", tc.result)
		})
	}

	t.Run("stale_repository_binding", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toComprehension()
		j.writeRepository("repository changed after TEST")
		j.assertRejected(domain.ErrRepositoryDrift, "comprehension_passed", "", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "passed", nil))
	})
	for _, target := range []string{"test_record", "requirements_revision", "design_revision", "task_plan_revision"} {
		t.Run("stale_"+target, func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toComprehension()
			tampered := &journeyTamperingStore{Store: j.store, mutate: func(task *domain.ProcessTask) {
				switch target {
				case "test_record":
					task.Test.RepositoryBindingDigest = domain.Digest(strings.Repeat("f", 64))
				case "requirements_revision":
					task.Test.RequirementsRevision++
				case "design_revision":
					task.Test.DesignRevision++
				case "task_plan_revision":
					task.Test.TaskPlanRevision++
				}
			}}
			service, err := application.NewService(tampered, repository.NewGitObserver())
			if err != nil {
				t.Fatal(err)
			}
			before := j.state()
			_, err = service.ApplyAction(context.Background(), journeyApplyRequest(j.task, "stale-comprehension", journeyPayload(t, j.task, "comprehension_passed", "", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "passed", nil))))
			if err != domain.ErrStorageUnavailable {
				t.Fatalf("error=%v", err)
			}
			j.assertStateUnchanged(before)
		})
	}
	t.Run("direct_TEST_to_DELIVERY", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toTest()
		j.assertRejected(domain.ErrInvalidArgument, "delivery_complete", "", deliveryJourneyResult(j.task))
	})
	t.Run("direct_REFACTOR_to_COMPREHENSION", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toComprehension()
		j.apply("code_too_complex", "The code contains an unnecessary layer.", comprehensionJourneyResult(nil, nil, []string{"factory"}, "", "", []string{"Code complexity"}))
		j.assertRejected(domain.ErrInvalidArgument, "comprehension_passed", "", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "passed", nil))
	})
}

func TestProcessGraphIterationNegativeDelivery(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any, domain.ProcessTask)
	}{
		{"wrong_test_record_id", func(v map[string]any, _ domain.ProcessTask) { v["test_record_id"] = "wrong-test" }},
		{"wrong_comprehension_record_id", func(v map[string]any, _ domain.ProcessTask) { v["comprehension_record_id"] = "wrong-comprehension" }},
		{"acceptance_count", func(v map[string]any, _ domain.ProcessTask) { v["acceptance"] = []any{} }},
		{"acceptance_order", func(v map[string]any, task domain.ProcessTask) {
			v["acceptance"] = []map[string]any{{"criterion": task.Requirements.AcceptanceCriteria[1], "status": "satisfied"}, {"criterion": task.Requirements.AcceptanceCriteria[0], "status": "satisfied"}}
		}},
		{"acceptance_text", func(v map[string]any, _ domain.ProcessTask) {
			v["acceptance"] = []map[string]any{{"criterion": "wrong", "status": "satisfied"}, {"criterion": "second acceptance", "status": "satisfied"}}
		}},
		{"acceptance_status", func(v map[string]any, task domain.ProcessTask) {
			v["acceptance"] = []map[string]any{{"criterion": task.Requirements.AcceptanceCriteria[0], "status": "unsatisfied"}, {"criterion": task.Requirements.AcceptanceCriteria[1], "status": "satisfied"}}
		}},
		{"missing_evidence", func(v map[string]any, _ domain.ProcessTask) {
			v["automated_evidence_ids"] = []string{"missing-evidence"}
		}},
		{"automated_references_user", func(v map[string]any, task domain.ProcessTask) {
			v["automated_evidence_ids"] = []string{string(task.Comprehension.UserEvidenceID)}
		}},
		{"manual_references_automated", func(v map[string]any, task domain.ProcessTask) {
			v["manual_evidence_ids"] = []string{string(task.Test.EvidenceIDs[0])}
		}},
		{"automated_references_static", func(v map[string]any, task domain.ProcessTask) {
			v["automated_evidence_ids"] = []string{string(task.Test.EvidenceIDs[1])}
		}},
		{"automated_references_host_observed", func(v map[string]any, task domain.ProcessTask) {
			v["automated_evidence_ids"] = []string{string(task.Test.EvidenceIDs[2])}
		}},
		{"duplicate_evidence_in_list", func(v map[string]any, task domain.ProcessTask) {
			id := string(task.Test.EvidenceIDs[0])
			v["automated_evidence_ids"] = []string{id, id}
		}},
		{"duplicate_evidence_across_lists", func(v map[string]any, task domain.ProcessTask) {
			id := string(task.Test.EvidenceIDs[0])
			v["automated_evidence_ids"], v["manual_evidence_ids"] = []string{id}, []string{id}
		}},
		{"unverified_items", func(v map[string]any, _ domain.ProcessTask) { v["unverified_items"] = []string{"remaining"} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toDelivery()
			result := deliveryJourneyResult(j.task)
			tc.mutate(result, j.task)
			want := domain.ErrTransitionNotAllowed
			if tc.name == "acceptance_status" {
				want = domain.ErrInvalidArgument
			}
			j.assertRejected(want, "delivery_complete", "", result)
		})
	}

	for _, target := range []string{"test", "comprehension", "stale_test", "stale_comprehension", "requirements", "design", "task_plan"} {
		t.Run("stale_or_missing_"+target, func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toDelivery()
			base := j.store
			tampered := &journeyTamperingStore{Store: base, mutate: func(task *domain.ProcessTask) {
				switch target {
				case "test":
					task.Test = nil
				case "comprehension":
					task.Comprehension = nil
				case "stale_test":
					task.Test.RepositoryBindingDigest = domain.Digest(strings.Repeat("f", 64))
				case "stale_comprehension":
					task.Comprehension.RepositoryBindingDigest = domain.Digest(strings.Repeat("f", 64))
				case "requirements":
					task.Requirements.Revision++
				case "design":
					task.Design.Revision++
				case "task_plan":
					task.TaskPlan.Revision++
				}
			}}
			service, err := application.NewService(tampered, repository.NewGitObserver())
			if err != nil {
				t.Fatal(err)
			}
			before := j.state()
			_, err = service.ApplyAction(context.Background(), journeyApplyRequest(j.task, "tampered-delivery", journeyPayload(t, j.task, "delivery_complete", "", deliveryJourneyResult(j.task))))
			want := domain.ErrStorageUnavailable
			if err != want {
				t.Fatalf("error=%v", err)
			}
			j.assertStateUnchanged(before)
		})
	}
	t.Run("repository_digest_mismatch", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toDelivery()
		j.writeRepository("changed after comprehension")
		j.assertRejected(domain.ErrRepositoryDrift, "delivery_complete", "", deliveryJourneyResult(j.task))
	})
	t.Run("direct_COMPREHENSION_to_DONE", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toComprehension()
		j.assertRejected(domain.ErrInvalidArgument, "delivery_complete", "", deliveryJourneyResult(j.task))
	})
}

func TestProcessGraphReworkRequirementsAndDesign(t *testing.T) {
	t.Run("TEST_to_REQUIREMENTS_revision_rebinding", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toTest()
		oldRequirementsDigest := j.task.Requirements.Digest
		j.apply("tests_expose_requirement_issue", "The test exposed an acceptance gap.", failedTestJourneyResult("requirement gap"))
		if j.task.CurrentNode != domain.NodeRequirements || j.task.Design != nil || j.task.TaskPlan != nil || j.task.Implementation != nil || j.task.Test != nil || j.task.Comprehension != nil {
			t.Fatal("requirements rework retained downstream authority")
		}
		j.apply("requirements_ready", "", requirementsJourneyResult("Revised goal"))
		if j.task.Requirements.Revision != 2 || j.task.Requirements.Digest == oldRequirementsDigest || !journeyHasHistory(j.task, domain.BaselineRequirements, 1) {
			t.Fatal("requirements revision/history did not advance")
		}
		j.assertRejected(domain.ErrInvalidArgument, "design_ready", "", designJourneyResult(1, "Stale design"))
		j.apply("design_ready", "", designJourneyResult(2, "Rebound design"))
		j.assertRejected(domain.ErrInvalidArgument, "tasks_ready", "", tasksJourneyResult(1))
		j.apply("tasks_ready", "", tasksJourneyResult(2))
	})

	t.Run("COMPREHENSION_to_DESIGN_revision_rebinding", func(t *testing.T) {
		j := newIterationJourney(t)
		defer j.close()
		j.toComprehension()
		requirements := j.task.Requirements
		j.apply("design_too_complex", "The design has unnecessary layers.", comprehensionJourneyResult(nil, nil, []string{"layer"}, "", "", []string{"Design complexity"}))
		if j.task.CurrentNode != domain.NodeDesign || j.task.Requirements.Revision != requirements.Revision || j.task.TaskPlan != nil || j.task.Implementation != nil || j.task.Test != nil || j.task.Comprehension != nil {
			t.Fatal("design rework invalidation mismatch")
		}
		j.apply("design_ready", "", designJourneyResult(requirements.Revision, "Simplified design"))
		if j.task.Design.Revision != 2 || !journeyHasHistory(j.task, domain.BaselineDesign, 1) {
			t.Fatal("design revision/history did not advance")
		}
		j.assertRejected(domain.ErrInvalidArgument, "tasks_ready", "", tasksJourneyResult(1))
		j.apply("tasks_ready", "", tasksJourneyResult(2))
	})
}

func TestProcessGraphReworkDeliveryRemediation(t *testing.T) {
	tests := []struct {
		transition  domain.TransitionID
		destination domain.NodeID
	}{
		{"delivery_needs_implementation", domain.NodeImplement},
		{"delivery_needs_test", domain.NodeTest},
		{"delivery_needs_comprehension", domain.NodeComprehensionReview},
		{"delivery_needs_design", domain.NodeDesign},
		{"delivery_needs_requirements", domain.NodeRequirements},
	}
	for _, tc := range tests {
		t.Run(string(tc.transition), func(t *testing.T) {
			j := newIterationJourney(t)
			defer j.close()
			j.toDelivery()
			taskID := j.task.TaskID
			j.apply(tc.transition, "Delivery reconciliation found a bounded gap.", deliveryRemediationJourneyResult())
			if j.task.CurrentNode != tc.destination || j.task.Outcome != nil || j.task.CompletedAt != nil || j.task.TaskID != taskID || j.claimCount() != 1 {
				t.Fatal("delivery remediation created terminal state, released the claim, or changed identity")
			}
			switch tc.destination {
			case domain.NodeRequirements:
				if j.task.Design != nil || j.task.TaskPlan != nil || j.task.Implementation != nil || j.task.Test != nil || j.task.Comprehension != nil {
					t.Fatal("requirements remediation invalidation mismatch")
				}
			case domain.NodeDesign:
				if j.task.Requirements == nil || j.task.TaskPlan != nil || j.task.Implementation != nil || j.task.Test != nil || j.task.Comprehension != nil {
					t.Fatal("design remediation invalidation mismatch")
				}
			case domain.NodeImplement, domain.NodeTest:
				if j.task.Test != nil || j.task.Comprehension != nil {
					t.Fatal("implementation/test remediation invalidation mismatch")
				}
			case domain.NodeComprehensionReview:
				if j.task.Test == nil || j.task.Comprehension != nil {
					t.Fatal("comprehension remediation invalidation mismatch")
				}
			}
		})
	}
}

type journeyTamperingStore struct {
	store.Store
	mutate func(*domain.ProcessTask)
}

func (s *journeyTamperingStore) LoadTask(ctx context.Context, id domain.ID) (domain.ProcessTask, error) {
	task, err := s.Store.LoadTask(ctx, id)
	if err == nil {
		s.mutate(&task)
	}
	return task, err
}

func newIterationJourney(t *testing.T) *iterationJourney {
	return newIterationJourneyWithManualHandoff(t, true)
}

func newIterationJourneyWithManualHandoff(t *testing.T, allowManualHandoff bool) *iterationJourney {
	t.Helper()
	repo := filepath.Join(t.TempDir(), "repository")
	if err := os.Mkdir(repo, 0o755); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, repo, "init", "-q")
	runJourneyGit(t, repo, "config", "user.email", "journey@example.invalid")
	runJourneyGit(t, repo, "config", "user.name", "Journey Test")
	if err := os.WriteFile(filepath.Join(repo, "README.md"), []byte("initial\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runJourneyGit(t, repo, "add", "README.md")
	runJourneyGit(t, repo, "commit", "-q", "-m", "initial")
	dbPath := filepath.Join(t.TempDir(), "dev-flow.db")
	sqliteStore, err := store.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatal(err)
	}
	service, err := application.NewService(sqliteStore, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "open-journey", Host: domain.HostCodex, RepositoryPath: repo, NewTask: &application.NewTaskInput{Request: "Prove the iterative development loop.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 16, AllowManualHandoff: allowManualHandoff}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	j := &iterationJourney{t: t, service: service, store: sqliteStore, dbPath: dbPath, repo: repo, task: opened.Task}
	if j.task.Revision != 1 || j.eventCount() != 1 || j.claimCount() != 1 || j.task.CurrentAction == nil {
		t.Fatal("open task did not atomically establish task, event, claim, and action")
	}
	return j
}

func (j *iterationJourney) close() {
	if j.store != nil {
		_ = j.store.Close()
		j.store = nil
	}
}

func (j *iterationJourney) writeRepository(content string) {
	j.t.Helper()
	if err := os.WriteFile(filepath.Join(j.repo, "feature.txt"), []byte(content+"\n"), 0o644); err != nil {
		j.t.Fatal(err)
	}
}

func (j *iterationJourney) apply(transition domain.TransitionID, reason string, node any) {
	j.t.Helper()
	before := j.state()
	requestID := domain.ID(fmt.Sprintf("request-%02d-%s", j.task.Revision, transition))
	result, err := j.service.ApplyAction(context.Background(), journeyApplyRequest(j.task, requestID, journeyPayload(j.t, j.task, transition, reason, node)))
	if err != nil {
		j.t.Fatalf("apply %s: %v", transition, err)
	}
	j.task = result.Task
	if j.task.Revision != before.revision+1 || j.eventCount() != before.events+1 || j.task.LastOperation == nil || j.task.LastOperation.OperationID != requestID || j.task.LastOperation.ToRevision != j.task.Revision {
		j.t.Fatalf("%s revision/event/LastOperation mismatch", transition)
	}
	eventTransition, eventDestination, eventRequest := j.latestEvent()
	if eventTransition != transition || eventDestination != j.task.CurrentNode || eventRequest != requestID {
		j.t.Fatalf("%s event authority mismatch", transition)
	}
	if j.task.CurrentAction != nil && (j.task.CurrentAction.ActionID == before.actionID || j.task.CurrentAction.Revision != j.task.Revision || j.task.CurrentAction.NodeID != j.task.CurrentNode) {
		j.t.Fatalf("%s did not issue a complete fresh action", transition)
	}
	if !j.task.CurrentNode.Terminal() && j.claimCount() != 1 {
		j.t.Fatalf("%s lost the active repository claim", transition)
	}
}

func (j *iterationJourney) assertRejected(want error, transition domain.TransitionID, reason string, node any) {
	j.t.Helper()
	before := j.state()
	_, err := j.service.ApplyAction(context.Background(), journeyApplyRequest(j.task, "rejected-"+domain.ID(transition), journeyPayload(j.t, j.task, transition, reason, node)))
	if !errors.Is(err, want) {
		j.t.Fatalf("transition=%s error=%v want=%v", transition, err, want)
	}
	j.assertStateUnchanged(before)
}

func (j *iterationJourney) state() journeyState {
	actionID := domain.ID("")
	if j.task.CurrentAction != nil {
		actionID = j.task.CurrentAction.ActionID
	}
	return journeyState{revision: j.task.Revision, events: j.eventCount(), evidence: len(j.task.Evidence), claims: j.claimCount(), actionID: actionID}
}

func (j *iterationJourney) assertStateUnchanged(before journeyState) {
	j.t.Helper()
	loaded, err := j.store.LoadTask(context.Background(), j.task.TaskID)
	if err != nil {
		j.t.Fatal(err)
	}
	actionID := domain.ID("")
	if loaded.CurrentAction != nil {
		actionID = loaded.CurrentAction.ActionID
	}
	after := journeyState{revision: loaded.Revision, events: j.eventCount(), evidence: len(loaded.Evidence), claims: j.claimCount(), actionID: actionID}
	if after != before {
		j.t.Fatalf("rejected mutation changed state: before=%+v after=%+v", before, after)
	}
}

func (j *iterationJourney) toTest() {
	j.apply("requirements_ready", "", requirementsJourneyResult("Current goal"))
	j.apply("design_ready", "", designJourneyResult(j.task.Requirements.Revision, "Direct design"))
	j.apply("tasks_ready", "", tasksJourneyResult(j.task.Design.Revision))
	j.writeRepository("implementation")
	j.apply("implementation_ready_for_test", "", implementationJourneyResult(j.task.TaskPlan.Revision, []string{"feature.txt"}, nil))
}

func (j *iterationJourney) toComprehension() {
	j.toTest()
	j.apply("tests_passed", "", passedTestJourneyResult())
}

func (j *iterationJourney) toDelivery() {
	j.toComprehension()
	j.apply("comprehension_passed", "", comprehensionJourneyResult([]string{"component"}, nil, nil, "user", "passed", nil))
}

func (j *iterationJourney) eventCount() int {
	return j.count(`SELECT COUNT(*) FROM task_events WHERE task_id=?`)
}
func (j *iterationJourney) claimCount() int {
	return j.count(`SELECT COUNT(*) FROM repository_claims WHERE task_id=?`)
}
func (j *iterationJourney) count(query string) int {
	j.t.Helper()
	db, err := sql.Open("sqlite", j.dbPath)
	if err != nil {
		j.t.Fatal(err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRow(query, j.task.TaskID).Scan(&count); err != nil {
		j.t.Fatal(err)
	}
	return count
}

func (j *iterationJourney) latestEvent() (domain.TransitionID, domain.NodeID, domain.ID) {
	j.t.Helper()
	db, err := sql.Open("sqlite", j.dbPath)
	if err != nil {
		j.t.Fatal(err)
	}
	defer db.Close()
	var transition, destination, request string
	if err := db.QueryRow(`SELECT transition_id,destination_node,request_id FROM task_events WHERE task_id=? ORDER BY revision DESC LIMIT 1`, j.task.TaskID).Scan(&transition, &destination, &request); err != nil {
		j.t.Fatal(err)
	}
	return domain.TransitionID(transition), domain.NodeID(destination), domain.ID(request)
}

func (j *iterationJourney) evidence(id domain.ID) domain.EvidenceSummary {
	for _, item := range j.task.Evidence {
		if item.EvidenceID == id {
			return item
		}
	}
	j.t.Fatalf("missing evidence %s", id)
	return domain.EvidenceSummary{}
}

func journeyApplyRequest(task domain.ProcessTask, requestID domain.ID, payload json.RawMessage) application.ApplyActionRequest {
	a := task.CurrentAction
	return application.ApplyActionRequest{RequestID: requestID, Host: domain.HostCodex, TaskID: task.TaskID, ExpectedRevision: task.Revision, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: task.Process.ID, ProcessDefinitionDigest: task.Process.DefinitionDigest, SourceCursor: task.CurrentNode, RepositoryBindingDigest: task.Repository.BindingDigest, Payload: payload}
}

func journeyPayload(t *testing.T, task domain.ProcessTask, transition domain.TransitionID, reason string, node any) json.RawMessage {
	t.Helper()
	if fields, ok := node.(map[string]any); ok {
		fields["problem_class"] = journeyProblemClass(transition)
	}
	methodEvidence := []map[string]any{}
	if task.CurrentAction != nil {
		for _, step := range task.CurrentAction.SemanticMethodSteps {
			methodEvidence = append(methodEvidence, map[string]any{"step_id": step.StepID, "status": "plain_fallback", "capability": "", "summary": "Completed the current semantic method step."})
		}
	}
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "The journey recorded the current result.", "reason": reason, "artifacts": []any{}, "method_evidence": methodEvidence, "node_result": node})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func journeyProblemClass(transition domain.TransitionID) string {
	classes := map[domain.TransitionID]string{
		"requirements_ready": "none",
		"design_ready":       "none", "design_requires_requirements": "requirement_gap",
		"tasks_ready": "none", "tasks_require_design": "design_gap", "tasks_require_requirements": "requirement_gap",
		"implementation_ready_for_test": "none", "implementation_requires_design": "design_gap", "implementation_requires_requirements": "requirement_gap", "implementation_needs_refactor": "code_complexity",
		"tests_passed": "none", "tests_failed_implementation": "implementation_failure", "tests_expose_design_issue": "design_failure", "tests_expose_requirement_issue": "requirement_gap",
		"comprehension_passed": "none", "implementation_defect": "implementation_defect", "code_too_complex": "code_complexity", "design_too_complex": "design_complexity", "evidence_insufficient": "verification_gap", "requirement_unclear": "requirement_gap",
		"refactor_ready_for_test": "none", "refactor_requires_design": "design_change", "refactor_requires_requirements": "requirement_change",
		"delivery_complete": "none", "delivery_needs_implementation": "implementation_gap", "delivery_needs_test": "test_gap", "delivery_needs_comprehension": "comprehension_gap", "delivery_needs_design": "design_gap", "delivery_needs_requirements": "requirement_gap",
	}
	return classes[transition]
}

func requirementsJourneyResult(goal string) map[string]any {
	return map[string]any{"baseline": map[string]any{"goal": goal, "scope": []string{"iterative loop"}, "out_of_scope": []string{}, "acceptance_criteria": []string{"first acceptance", "second acceptance"}, "constraints": []string{}, "assumptions": []string{}}, "unresolved_questions": []string{}}
}

func designJourneyResult(requirementsRevision uint32, approach string) map[string]any {
	return map[string]any{"baseline": map[string]any{"requirements_revision": requirementsRevision, "approach": approach, "components": []string{"process"}, "decisions": []string{"Use the direct flow"}, "rejected_alternatives": []string{}, "complexity_justification": []string{}, "risks": []string{}}, "findings": []string{}}
}

func tasksJourneyResult(designRevision uint32) map[string]any {
	return map[string]any{"baseline": map[string]any{"design_revision": designRevision, "work_items": []map[string]any{{"work_item_id": "work", "summary": "Implement the flow", "expected_paths": []string{"feature.txt"}, "acceptance_indexes": []uint32{0, 1}, "verification_steps": []string{"Run targeted tests"}, "dependencies": []string{}}}}, "findings": []string{}}
}

func implementationJourneyResult(planRevision uint32, changedPaths, findings []string) map[string]any {
	if findings == nil {
		findings = []string{}
	}
	return map[string]any{"task_plan_revision": planRevision, "completed_work_item_ids": []string{"work"}, "changed_paths": changedPaths, "no_file_changes": len(changedPaths) == 0, "deviations": []string{}, "findings": findings}
}

func passedTestJourneyResult() map[string]any {
	return map[string]any{"checks": []map[string]any{
		{"source": "automated", "name": "targeted-test", "status": "passed", "summary": "The targeted test passed.", "command_count": 1, "full_suite": false},
		{"source": "static", "name": "static-review", "status": "passed", "summary": "Static review completed.", "command_count": 0, "full_suite": false},
		{"source": "host_observed", "name": "host-observation", "status": "passed", "summary": "The host observed the result.", "command_count": 0, "full_suite": false},
	}, "failed_items": []string{}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{}}
}

func failedTestJourneyResult(finding string) map[string]any {
	return map[string]any{"checks": []map[string]any{{"source": "automated", "name": "targeted-test", "status": "failed", "summary": "The targeted test failed.", "command_count": 1, "full_suite": false}}, "failed_items": []string{"targeted failure"}, "unverified_items": []string{}, "manual_handoff_items": []string{}, "findings": []string{finding}}
}

func comprehensionJourneyResult(explained, unresolved, abstractions []string, source, status string, findings []string) map[string]any {
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
		confirmation = map[string]any{"source": source, "status": status, "summary": "The developer confirmed understanding."}
	}
	return map[string]any{"explained_components": explained, "unresolved_questions": unresolved, "unnecessary_abstractions": abstractions, "maintenance_risks": []string{}, "user_confirmation": confirmation, "findings": findings}
}

func refactorJourneyResult(paths, simplifications []string, behaviorChange bool, findings []string) map[string]any {
	if findings == nil {
		findings = []string{}
	}
	return map[string]any{"changed_paths": paths, "no_file_changes": len(paths) == 0, "simplifications": simplifications, "behavior_change_intended": behaviorChange, "findings": findings}
}

func deliveryJourneyResult(task domain.ProcessTask) map[string]any {
	automated := []string{}
	if task.Test != nil && len(task.Test.EvidenceIDs) > 0 {
		automated = []string{string(task.Test.EvidenceIDs[0])}
	}
	manual := []string{}
	if task.Comprehension != nil {
		manual = []string{string(task.Comprehension.UserEvidenceID)}
	}
	testID, comprehensionID := domain.ID(""), domain.ID("")
	if task.Test != nil {
		testID = task.Test.RecordID
	}
	if task.Comprehension != nil {
		comprehensionID = task.Comprehension.RecordID
	}
	acceptance := []map[string]any{}
	if task.Requirements != nil {
		for _, criterion := range task.Requirements.AcceptanceCriteria {
			acceptance = append(acceptance, map[string]any{"criterion": criterion, "status": "satisfied"})
		}
	}
	return map[string]any{"acceptance": acceptance, "automated_evidence_ids": automated, "manual_evidence_ids": manual, "test_record_id": testID, "comprehension_record_id": comprehensionID, "unverified_items": []string{}, "risks": []string{}, "findings": []string{}}
}

func deliveryRemediationJourneyResult() map[string]any {
	return map[string]any{"acceptance": []any{}, "automated_evidence_ids": []string{}, "manual_evidence_ids": []string{}, "test_record_id": "", "comprehension_record_id": "", "unverified_items": []string{}, "risks": []string{}, "findings": []string{"bounded delivery gap"}}
}

func assertTransitionAbsent(t *testing.T, task domain.ProcessTask, transition domain.TransitionID) {
	t.Helper()
	for _, candidate := range task.CurrentAction.AvailableTransitions {
		if candidate.TransitionID == transition {
			t.Fatalf("unexpected transition %s", transition)
		}
	}
}

func journeyHasHistory(task domain.ProcessTask, kind domain.BaselineKind, revision uint32) bool {
	for _, ref := range task.BaselineHistory {
		if ref.Kind == kind && ref.Revision == revision && ref.Digest.IsValid() && ref.Summary != "" && !ref.CreatedAt.IsZero() {
			return true
		}
	}
	return false
}

func runJourneyGit(t *testing.T, directory string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = directory
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %s: %v: %s", strings.Join(args, " "), err, output)
	}
}
