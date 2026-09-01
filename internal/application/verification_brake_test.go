package application

import (
	"context"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestAutomaticBrakeBlocksThirdRepeatedFailureAndAllowsOneRetry(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	failure := testNodeResult([]map[string]any{evidenceCheck("automated", "failed", "auth-lockout-test", 1, false)}, []string{"lockout still fails"}, nil, []string{"same implementation failure"})

	for attempt := 1; attempt <= 3; attempt++ {
		task = applyPhase5(t, service, task, "tests_failed_implementation", "Failure remains.", failure)
		if attempt < 3 {
			if task.CurrentNode != domain.NodeImplement || task.Blocker != nil {
				t.Fatalf("attempt %d task=%+v", attempt, task)
			}
			task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
		}
	}
	if task.CurrentNode != domain.NodeBlocked || task.ResumeNode == nil || *task.ResumeNode != domain.NodeImplement || task.Blocker == nil ||
		task.Blocker.Cause != domain.BlockerCauseRepeatedVerificationFailure || task.Blocker.Condition.Kind != domain.BlockerConditionAllowVerificationRetry ||
		len(task.VerificationAttempts) != domain.MaxRetainedVerificationAttempts || memory.lastMutation.Event.TransitionID != nil {
		t.Fatalf("blocked task=%+v event=%+v", task, memory.lastMutation.Event)
	}
	firstBlockerID := task.Blocker.BlockerID
	resolved, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID}, "allow-one-retry")
	if err != nil {
		t.Fatal(err)
	}
	task = resolved.Task
	if task.CurrentNode != domain.NodeImplement || task.Blocker != nil || task.ResumeNode != nil {
		t.Fatalf("resolved task=%+v", task)
	}
	task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
	task = applyPhase5(t, service, task, "tests_failed_implementation", "Failure remains.", failure)
	if task.CurrentNode != domain.NodeBlocked || task.Blocker == nil || task.Blocker.BlockerID == firstBlockerID || task.Blocker.Cause != domain.BlockerCauseRepeatedVerificationFailure {
		t.Fatalf("single retry did not brake again: %+v", task)
	}
}

func TestAutomaticBrakeClassifiesUnchangedResultAndImplementationLoop(t *testing.T) {
	t.Run("unchanged result", func(t *testing.T) {
		service, _, _ := phase5Service(t)
		task := phase5TaskAtTest(t, service)
		result := testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "unchanged-probe", 1, false)}, []string{"behavior still fails"}, nil, []string{"same failure"})
		for attempt := 1; attempt <= 3; attempt++ {
			task = applyPhase5(t, service, task, "tests_failed_implementation", "Failure remains.", result)
			if attempt < 3 {
				task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
			}
		}
		if task.Blocker == nil || task.Blocker.Cause != domain.BlockerCauseUnchangedVerificationResult {
			t.Fatalf("blocker=%+v", task.Blocker)
		}
	})

	t.Run("implementation loop", func(t *testing.T) {
		service, memory, _ := phase5Service(t)
		task := phase5TaskAtTest(t, service)
		for attempt := 1; attempt <= 3; attempt++ {
			implementation := *task.Implementation
			implementation.ChangedPaths = []string{"internal/auth.go"}
			implementation.NoFileChanges = false
			task.Implementation = &implementation
			memory.task = &task
			result := testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "probe-"+string(rune('a'+attempt-1)), 1, false)}, []string{"behavior still fails"}, nil, []string{"same failure"})
			task = applyPhase5(t, service, task, "tests_failed_implementation", "Failure remains.", result)
			if attempt < 3 {
				task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
			}
		}
		if task.Blocker == nil || task.Blocker.Cause != domain.BlockerCauseUnchangedTestImplementationLoop {
			t.Fatalf("blocker=%+v", task.Blocker)
		}
	})
}

func TestAutomaticBrakeDoesNotMergeDifferentFailures(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	for attempt, name := range []string{"first-failure", "second-failure", "third-failure"} {
		result := testNodeResult([]map[string]any{evidenceCheck("automated", "failed", name, 1, false)}, []string{name}, nil, []string{name})
		task = applyPhase5(t, service, task, "tests_failed_implementation", "Failure changed.", result)
		if attempt < 2 {
			task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
		}
	}
	if task.CurrentNode != domain.NodeImplement || task.Blocker != nil {
		t.Fatalf("different failures were braked: %+v", task)
	}
}
