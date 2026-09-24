package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type repositoryScopeObserver struct {
	origins  map[string]domain.WorkspaceOrigin
	bindings map[string]domain.RepositoryBinding
}

func (o repositoryScopeObserver) Observe(_ context.Context, path string) (domain.RepositoryBinding, error) {
	binding, ok := o.bindings[path]
	if !ok {
		return domain.RepositoryBinding{}, domain.ErrWorkspaceUnavailable
	}
	return binding, nil
}

func (o repositoryScopeObserver) ObserveWorkspace(_ context.Context, path string, _ repository.WorkspaceOriginSelection, _ *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	binding, ok := o.bindings[path]
	if !ok {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, domain.ErrWorkspaceUnavailable
	}
	return o.origins[path], binding, nil
}

// TestSubmitTasksReportsUnqualifiedMultiRepositoryPaths proves the complete MCP
// path returns the failing member for a plan whose paths omit their repository
// key, writes nothing, and still accepts the repository-qualified form.
func TestSubmitTasksReportsUnqualifiedMultiRepositoryPaths(t *testing.T) {
	now := time.Date(2026, 9, 22, 6, 0, 0, 0, time.UTC)
	corePath, docsPath := testPath("core"), testPath("docs")
	coreOrigin, coreBinding, coreInput := mcpWorkspaceFixture(now, corePath, 'a')
	docsOrigin, docsBinding, docsInput := mcpWorkspaceFixture(now, docsPath, 'b')
	database, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "tasks.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	observer := repositoryScopeObserver{
		origins:  map[string]domain.WorkspaceOrigin{corePath: coreOrigin, docsPath: docsOrigin},
		bindings: map[string]domain.RepositoryBinding{corePath: coreBinding, docsPath: docsBinding},
	}
	service, err := application.NewService(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{
		RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: corePath, WorkspaceOrigin: &coreInput,
		PrimaryRepositoryKey:   "core",
		AdditionalRepositories: []application.AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath, WorkspaceOrigin: docsInput}},
		NewTask:                &application.NewTaskInput{Request: "Change the endpoint.", MethodProfile: domain.MethodPlain},
	})
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(service, "test", &ServerOptions{NewRequestID: func() (domain.ID, error) { return "request-dispatch", nil }})
	if err != nil {
		t.Fatal(err)
	}

	read := func() domain.ProcessTask {
		t.Helper()
		result, readErr := service.GetTask(context.Background(), application.GetTaskRequest{Host: domain.HostCodex, TaskID: opened.Task.TaskID})
		if readErr != nil {
			t.Fatal(readErr)
		}
		return result.Task
	}
	dispatches := 0
	dispatch := func(tool string, input map[string]any) EncodedResult {
		t.Helper()
		dispatches++
		input["host"] = "codex"
		input["task_id"] = opened.Task.TaskID
		input["action_id"] = read().CurrentAction.ActionID
		raw, marshalErr := json.Marshal(input)
		if marshalErr != nil {
			t.Fatal(marshalErr)
		}
		return server.dispatch(context.Background(), tool, domain.ID(fmt.Sprintf("request-dispatch-%d", dispatches)), raw)
	}

	requirements := map[string]any{
		"transition_id": "requirements_ready", "summary": "Ready.", "reason": "",
		"artifacts": map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": map[string]any{
			"requirements.capture":  map[string]any{"capability": "", "summary": "Captured."},
			"requirements.clarify":  map[string]any{"capability": "", "summary": "Clarified."},
			"requirements.validate": map[string]any{"capability": "", "summary": "Validated."},
		},
		"node_result": map[string]any{"problem_class": "none", "baseline": map[string]any{"goal": "Goal", "scope": []any{}, "out_of_scope": []any{}, "acceptance_criteria": []string{"Works"}, "constraints": []any{}, "assumptions": []any{}}, "unresolved_questions": []any{}},
	}
	if encoded := dispatch(ToolSubmitRequirements, requirements); encoded.IsError {
		t.Fatalf("requirements failed: %s", encoded.JSON)
	}
	design := map[string]any{
		"transition_id": "design_ready", "summary": "Designed.", "reason": "",
		"artifacts": map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": map[string]any{
			"design.choose_approach":   map[string]any{"capability": "", "summary": "Chosen."},
			"design.review_complexity": map[string]any{"capability": "", "summary": "Reviewed."},
			"design.record_decisions":  map[string]any{"capability": "", "summary": "Recorded."},
		},
		"node_result": map[string]any{"problem_class": "none", "baseline": map[string]any{"approach": "Extend the mapper.", "components": []any{}, "decisions": []string{"Reuse the type."}, "rejected_alternatives": []any{}, "complexity_justification": []any{}, "risks": []any{}}, "findings": []any{}},
	}
	if encoded := dispatch(ToolSubmitDesign, design); encoded.IsError {
		t.Fatalf("design failed: %s", encoded.JSON)
	}
	if node := read().CurrentNode; node != domain.NodeTasks {
		t.Fatalf("node=%s", node)
	}

	plan := func(paths []string) map[string]any {
		return map[string]any{
			"transition_id": "tasks_plan_saved", "summary": "Planned.", "reason": "",
			"artifacts": map[string]any{"current": []any{}, "other_process": []any{}},
			"method_results": map[string]any{
				"tasks.decompose":           map[string]any{"capability": "", "summary": "Decomposed."},
				"tasks.map_acceptance":      map[string]any{"capability": "", "summary": "Mapped."},
				"tasks.analyze_consistency": map[string]any{"capability": "", "summary": "Analyzed."},
				"tasks.plan_verification":   map[string]any{"capability": "", "summary": "Planned checks."},
			},
			"node_result": map[string]any{
				"problem_class": "none", "user_confirmation": nil,
				"baseline": map[string]any{
					"work_items": []any{map[string]any{
						"work_item_id": "work-endpoint", "summary": "Return the field.", "expected_paths": paths,
						"acceptance_indexes": []any{0}, "verification_steps": []any{"Run endpoint-check."}, "dependencies": []any{},
					}},
					"verification_plan": map[string]any{
						"checks":              []any{map[string]any{"name": "endpoint-check", "rationale": "Covers the changed contract."}},
						"initial_budget":      map[string]any{"level": "targeted", "max_automatic_commands": 4, "allow_full_suite": false, "allow_manual_handoff": false},
						"full_suite_expected": false, "test_code_changes_expected": true,
					},
				},
				"findings": []any{},
			},
		}
	}

	before := read()
	encoded := dispatch(ToolSubmitTasks, plan([]string{"src/endpoint.js"}))
	if !encoded.IsError {
		t.Fatalf("an unqualified path was accepted: %s", encoded.JSON)
	}
	envelope := decodeEnvelope(t, encoded)
	if envelope.Error == nil || envelope.Error.Code != domain.ErrorInvalidArgument {
		t.Fatalf("error=%#v", envelope.Error)
	}
	if len(envelope.Error.Details) != 1 {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	detail := envelope.Error.Details[0]
	if detail.Path != "node_result.baseline.work_items[0].expected_paths[0]" || detail.Rule != domain.RuleRepositoryPathInvalid {
		t.Fatalf("detail=%#v", detail)
	}
	if envelope.Recovery == nil || envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 0 {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
	if after := read(); after.Revision != before.Revision || after.TaskPlan != nil {
		t.Fatalf("a refused submission wrote state: revision=%d task_plan=%v", after.Revision, after.TaskPlan)
	}

	if encoded := dispatch(ToolSubmitTasks, plan([]string{"core::src/endpoint.js"})); encoded.IsError {
		t.Fatalf("a qualified path was refused: %s", encoded.JSON)
	}
	saved := read()
	if saved.TaskPlan == nil || len(saved.TaskPlan.WorkItems) != 1 || saved.TaskPlan.WorkItems[0].ExpectedPaths[0] != "core::src/endpoint.js" {
		t.Fatalf("saved plan=%+v", saved.TaskPlan)
	}
}
