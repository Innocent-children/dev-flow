package webui

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

func TestLifecycleHandlersCP2(t *testing.T) {
	mutator := &stubControlCenterMutator{}
	api, err := NewAPI(&stubControlCenterReader{}, mutator, func() SystemStatusResponse { return SystemStatusResponse{Readiness: ReadinessReady} })
	if err != nil {
		t.Fatal(err)
	}
	csrf := strings.Repeat("s", 32)
	budget := `{"level":"targeted","max_automatic_commands":2,"allow_full_suite":false,"allow_manual_handoff":true}`
	cases := []struct {
		name string
		path string
		body string
		call string
	}{
		{"create", "/api/tasks/open", `{"request_id":"open-request","mode":"create","request":"Create task","acceptance_criteria":["Task exists"],"verification_budget":` + quoteJSON(budget) + `,"method_profile":"plain","execution_host":"codex","primary_repository":{"key":"primary","path":"/repo"},"additional_repositories":[],"csrf":"` + csrf + `"}`, "open"},
		{"cancel", "/api/tasks/task/cancel", `{"request_id":"cancel-request","task_revision":1,"reason":"Stop task.","confirmed":true,"csrf":"` + csrf + `"}`, "cancel"},
		{"archive", "/api/tasks/task/archive", `{"request_id":"archive-request","task_revision":2,"archived":true,"csrf":"` + csrf + `"}`, "archive"},
		{"purge", "/api/tasks/task/purge", `{"request_id":"purge-request","task_revision":2,"typed_task_id":"task","reason":"Remove task.","irreversible":true,"csrf":"` + csrf + `"}`, "purge"},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, test.path, strings.NewReader(test.body))
			response := httptest.NewRecorder()
			api.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			var body MutationResponse
			if json.Unmarshal(response.Body.Bytes(), &body) != nil || !body.OK || mutator.lastCall != test.call {
				t.Fatalf("body=%#v call=%s", body, mutator.lastCall)
			}
		})
	}

	t.Run("unknown member is rejected", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodPost, "/api/tasks/task/archive", strings.NewReader(`{"request_id":"archive-request","task_revision":2,"archived":true,"csrf":"`+csrf+`","unknown":true}`))
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	})

	t.Run("stale mutation returns reload advice", func(t *testing.T) {
		mutator.stale = true
		request := httptest.NewRequest(http.MethodPost, "/api/tasks/task/cancel", strings.NewReader(`{"request_id":"stale-request","task_revision":1,"reason":"Stop task.","confirmed":true,"csrf":"`+csrf+`"}`))
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		var body FailureResponse
		if json.Unmarshal(response.Body.Bytes(), &body) != nil || response.Code != http.StatusConflict || body.Error.Code != string(domain.ErrorRevisionConflict) || body.Recovery.Action != RecoveryReadNextAction {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	})
}

func TestActionHandlersCP3(t *testing.T) {
	mutator := &stubControlCenterMutator{}
	api, err := NewAPI(&stubControlCenterReader{}, mutator, func() SystemStatusResponse { return SystemStatusResponse{Readiness: ReadinessReady} })
	if err != nil {
		t.Fatal(err)
	}
	digest := strings.Repeat("a", 64)
	csrf := strings.Repeat("s", 32)
	payload := `{"transition_id":"requirements_ready"}`
	operation := `{"operation_id":"action-request","expected_revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","process_id":"standard-development","process_definition_digest":"` + digest + `","source_node":"REQUIREMENTS","repository_binding_digest":"` + digest + `","payload":` + payload + `}`
	cases := []struct{ name, path, body, call string }{
		{"submit", "/api/tasks/task/actions/submit", `{"request_id":"action-request","task_revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","process_id":"standard-development","process_definition_digest":"` + digest + `","source_node":"REQUIREMENTS","repository_binding_digest":"` + digest + `","payload":` + payload + `,"csrf":"` + csrf + `"}`, "submit"},
		{"assess", "/api/tasks/task/recovery/assess", `{"operation":` + operation + `,"csrf":"` + csrf + `"}`, "assess"},
		{"apply", "/api/tasks/task/recovery/apply", `{"operation":` + operation + `,"recovery_action":"submit_recovery_apply","csrf":"` + csrf + `"}`, "recover"},
		{"resolve blocker", "/api/tasks/task/actions/submit", `{"request_id":"blocker-request","task_revision":2,"action_id":"blocker-action","action_kind":"RESOLVE_BLOCKER","process_id":"standard-development","process_definition_digest":"` + digest + `","source_node":"BLOCKED","repository_binding_digest":"` + digest + `","payload":{"blocker_id":"blocker","condition":{"kind":"restore_issuance_binding","expected_binding_digest":"` + digest + `"},"observed_binding_digest":"` + digest + `"},"csrf":"` + csrf + `"}`, "submit"},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			api.ServeHTTP(response, httptest.NewRequest(http.MethodPost, test.path, strings.NewReader(test.body)))
			if response.Code != http.StatusOK || mutator.lastCall != test.call {
				t.Fatalf("status=%d call=%s body=%s", response.Code, mutator.lastCall, response.Body.String())
			}
			var body MutationResponse
			if json.Unmarshal(response.Body.Bytes(), &body) != nil || !body.OK {
				t.Fatalf("body=%s", response.Body.String())
			}
			if test.call == "assess" && (body.Recovery == nil || body.Recovery.Action != RecoverySubmitRecoveryApply) {
				t.Fatalf("assessment body=%#v", body)
			}
		})
	}

	t.Run("field correction envelope", func(t *testing.T) {
		mutator.actionErr = domain.InvalidArgumentViolations(domain.Violation("payload.node_result.unknown", domain.RuleUnknownMember))
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(http.MethodPost, cases[0].path, strings.NewReader(cases[0].body)))
		var body FailureResponse
		if json.Unmarshal(response.Body.Bytes(), &body) != nil || response.Code != http.StatusBadRequest || body.Recovery.Action != RecoveryCorrectCurrentAction || !body.Recovery.RetrySafe || len(body.Error.FieldPaths) != 1 {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	})

	t.Run("guard envelope", func(t *testing.T) {
		mutator.actionErr = domain.TransitionGuardFailure("implementation_report_complete", domain.GuardViolation("payload.node_result.findings", domain.GuardForwardFindingsEmpty))
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(http.MethodPost, cases[0].path, strings.NewReader(cases[0].body)))
		var body FailureResponse
		if json.Unmarshal(response.Body.Bytes(), &body) != nil || response.Code != http.StatusConflict || body.Error.GuardID == nil || *body.Error.GuardID != "implementation_report_complete" || body.Recovery.Action != RecoveryCorrectCurrentAction {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	})
}

func TestFilterOptionsUseCurrentWorkflowDefinition(t *testing.T) {
	api, err := NewReadAPI(&stubControlCenterReader{}, func() SystemStatusResponse { return SystemStatusResponse{Readiness: ReadinessReady} })
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/system/filter-options", nil))
	var body FilterOptionsResponse
	if json.Unmarshal(response.Body.Bytes(), &body) != nil || response.Code != http.StatusOK || !body.OK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if len(body.NodeIDs) != 11 || body.NodeIDs[0] != string(domain.NodeRequirements) || body.NodeIDs[len(body.NodeIDs)-1] != string(domain.NodeCancelled) {
		t.Fatalf("node IDs=%v", body.NodeIDs)
	}
}

func TestTaskReadModelsExposeRepositoryGroupAndWorktree(t *testing.T) {
	group := strings.Repeat("a", 64)
	now := time.Date(2026, 8, 30, 2, 0, 0, 0, time.UTC)
	summaries := projectSummaries([]application.ControlCenterTaskSummary{{
		TaskID: "task", RequestSummary: "Parallel worktree task", OriginHost: domain.HostCodex,
		ExecutionHost: domain.HostCodex, CurrentNode: domain.NodeRequirements, Lifecycle: "active",
		Revision: 1, UpdatedAt: now, RepositoryKeys: []domain.RepositoryKey{"primary"},
		RepositoryGroupID: domain.Digest(group), WorktreePath: "/worktrees/task-a",
	}})
	if len(summaries) != 1 || summaries[0].RepositoryGroupID != group || summaries[0].WorktreePath != "/worktrees/task-a" {
		t.Fatalf("summary projection=%+v", summaries)
	}

	branch := "main"
	head := strings.Repeat("b", 40)
	digest := domain.Digest(strings.Repeat("c", 64))
	detail, err := projectTaskDetail("request-read", application.ControlCenterTaskDetail{Task: domain.ProcessTask{
		TaskID: "task", OriginHost: domain.HostCodex,
		Intent:      domain.TaskIntent{Request: "Parallel worktree task", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain},
		Process:     domain.ProcessReference{ID: domain.ProcessStandardDevelopment, DefinitionDigest: digest},
		CurrentNode: domain.NodeRequirements,
		Repository:  domain.RepositoryBinding{CanonicalRoot: "/worktrees/task-a", GitCommonDirDigest: domain.Digest(group), RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest},
		Revision:    1, CreatedAt: now, UpdatedAt: now,
	}})
	if err != nil || len(detail.Repositories) != 1 || detail.Repositories[0].RepositoryGroupID != group || detail.Repositories[0].Path != "/worktrees/task-a" {
		t.Fatalf("detail projection=%+v err=%v", detail.Repositories, err)
	}
}

type stubControlCenterMutator struct {
	lastCall  string
	stale     bool
	actionErr error
}

func (s *stubControlCenterMutator) OpenOrResumeTask(context.Context, application.OpenTaskRequest) (application.ControlCenterMutationResult, error) {
	s.lastCall = "open"
	return mutationTask(), nil
}

func (s *stubControlCenterMutator) CancelLifecycleTask(context.Context, application.CancelControlCenterTaskRequest) (application.ControlCenterMutationResult, error) {
	s.lastCall = "cancel"
	if s.stale {
		return application.ControlCenterMutationResult{}, domain.ErrRevisionConflict
	}
	return mutationTask(), nil
}

func (s *stubControlCenterMutator) SetTaskArchive(context.Context, application.SetTaskArchiveRequest) (application.ControlCenterMutationResult, error) {
	s.lastCall = "archive"
	archived := true
	return application.ControlCenterMutationResult{Archived: &archived}, nil
}

func (s *stubControlCenterMutator) PurgeLifecycleTask(context.Context, application.PurgeControlCenterTaskRequest) (application.ControlCenterMutationResult, error) {
	s.lastCall = "purge"
	return application.ControlCenterMutationResult{Purged: true}, nil
}

func (s *stubControlCenterMutator) SubmitCurrentAction(context.Context, application.SubmitControlCenterActionRequest) (application.ControlCenterActionResult, error) {
	s.lastCall = "submit"
	if s.actionErr != nil {
		return application.ControlCenterActionResult{}, s.actionErr
	}
	return actionMutation(), nil
}

func (s *stubControlCenterMutator) AssessTaskOperation(context.Context, application.AssessControlCenterRecoveryRequest) (application.ControlCenterActionResult, error) {
	s.lastCall = "assess"
	assessment := recovery.RecoveryAssessment{NextAdvice: recovery.AdviceSubmitRecoveryApply}
	return application.ControlCenterActionResult{Task: domain.ProcessTask{TaskID: "task", Revision: 2}, Assessment: &assessment}, nil
}

func (s *stubControlCenterMutator) ApplyTaskRecovery(context.Context, application.ApplyControlCenterRecoveryRequest) (application.ControlCenterActionResult, error) {
	s.lastCall = "recover"
	return actionMutation(), nil
}

func actionMutation() application.ControlCenterActionResult {
	return application.ControlCenterActionResult{Task: domain.ProcessTask{TaskID: "task", Revision: 2}, Committed: true}
}

func mutationTask() application.ControlCenterMutationResult {
	task := domain.ProcessTask{TaskID: "task", Revision: 2}
	return application.ControlCenterMutationResult{Task: &task}
}

func quoteJSON(value string) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}
