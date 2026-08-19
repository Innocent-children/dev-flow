package mcp

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestProcessActionMethodProfileAndStepsProjection(t *testing.T) {
	definition := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, "task", 1, methodProjectionDigest(), domain.MethodSpecKit, "action", time.Date(2026, 8, 19, 17, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	projected, ok := projectAction(&action).(map[string]any)
	if !ok || projected["method_profile"] != domain.MethodSpecKit {
		t.Fatalf("action projection=%#v", projected)
	}
	steps, ok := projected["method_steps"].([]domain.SemanticMethodStep)
	if !ok || len(steps) != 3 {
		t.Fatalf("method steps=%#v", projected["method_steps"])
	}
	for i, step := range action.SemanticMethodSteps {
		if steps[i] != step {
			t.Fatalf("step %d=%#v want=%#v", i, steps[i], step)
		}
	}

	task := domain.ProcessTask{Intent: domain.TaskIntent{MethodProfile: domain.MethodSpecKit}, CurrentAction: &action}
	raw, err := json.Marshal(projectTask(task))
	if err != nil {
		t.Fatal(err)
	}
	var taskProjection map[string]any
	if json.Unmarshal(raw, &taskProjection) != nil {
		t.Fatal("invalid task projection")
	}
	intent := taskProjection["intent"].(map[string]any)
	if intent["method_profile"] != string(domain.MethodSpecKit) {
		t.Fatalf("task intent projection=%#v", intent)
	}
}

func TestGetNextActionMethodProfileActiveBlockedDoneAndCancelled(t *testing.T) {
	definition := workflow.StandardProcess()
	now := time.Date(2026, 8, 19, 17, 0, 0, 0, time.UTC)
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, "task", 1, methodProjectionDigest(), domain.MethodOpenSpec, "action", now)
	if err != nil {
		t.Fatal(err)
	}
	blockedAction, err := workflow.BuildProcessAction(definition, domain.NodeBlocked, "task", 1, methodProjectionDigest(), domain.MethodOpenSpec, "blocked-action", now)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		node   domain.NodeID
		action *domain.ProcessActionV2
	}{
		{"active", domain.NodeRequirements, &action},
		{"blocked", domain.NodeBlocked, &blockedAction},
		{"done", domain.NodeDone, nil},
		{"cancelled", domain.NodeCancelled, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			value := projectNextAction(application.NextActionResult{TaskID: "task", Process: definition.Reference, CurrentNode: tc.node, Revision: 1, MethodProfile: domain.MethodOpenSpec, Action: tc.action})
			projection := value.(map[string]any)
			if projection["method_profile"] != domain.MethodOpenSpec {
				t.Fatalf("profile=%#v", projection["method_profile"])
			}
			if tc.action == nil && projection["action"] != nil {
				t.Fatal("terminal action projection is not null")
			}
		})
	}
}

func methodProjectionDigest() domain.Digest {
	return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
