package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Innocent-children/taskbelay/internal/domain"
	"github.com/Innocent-children/taskbelay/internal/store"
)

func TestZCodeTaskKeepsOriginHostAcrossResumeAndCancellation(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 9, 20, 1, 0, 0, 0, time.UTC)
	root := testPath("host-identity")
	origin, binding, selection := applicationWorkspaceFixture(now, root, 'a')
	memory := &memoryStore{}
	service, err := NewService(memory, observer{origin: origin, binding: binding})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(ctx, OpenTaskRequest{
		RequestID: "open-zcode", Host: domain.HostZCode, RepositoryPath: root, WorkspaceOrigin: &selection,
		NewTask: &NewTaskInput{Request: "Maintain the Claude adapter from ZCode.", MethodProfile: domain.MethodPlain},
	})
	if err != nil || !opened.Created || opened.Task.OriginHost != domain.HostZCode {
		t.Fatalf("opened=%+v err=%v", opened, err)
	}
	task := opened.Task
	resumed, err := service.OpenTask(ctx, OpenTaskRequest{RequestID: "resume-zcode", Host: domain.HostZCode, RepositoryPath: root})
	if err != nil || resumed.Created || resumed.Task.TaskID != task.TaskID || resumed.Task.CurrentAction.ActionID != task.CurrentAction.ActionID || resumed.Task.Revision != task.Revision {
		t.Fatalf("resume changed Task or Action: result=%+v err=%v", resumed, err)
	}
	for _, host := range []domain.Host{domain.HostCodex, domain.HostDeepSeek, domain.HostClaude} {
		t.Run(string(host), func(t *testing.T) {
			before := memory.commits
			_, readErr := service.GetTask(ctx, GetTaskRequest{Host: host, TaskID: task.TaskID})
			_, resumeErr := service.OpenTask(ctx, OpenTaskRequest{RequestID: "wrong-host-resume", Host: host, RepositoryPath: root})
			_, cancelErr := service.CancelTask(ctx, CancelTaskRequest{RequestID: "wrong-host-cancel", Host: host, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "Cancel the task."})
			for name, failure := range map[string]error{"read": readErr, "resume": resumeErr, "cancel": cancelErr} {
				if !errors.Is(failure, domain.ErrHostOwnershipConflict) {
					t.Fatalf("%s returned %v", name, failure)
				}
			}
			if memory.commits != before || memory.task.OriginHost != domain.HostZCode {
				t.Fatal("another Host changed the Task")
			}
		})
	}
	cancelled, err := service.CancelTask(ctx, CancelTaskRequest{RequestID: "cancel-zcode", Host: domain.HostZCode, TaskID: task.TaskID, ExpectedRevision: task.Revision, Reason: "The user cancelled the task."})
	if err != nil || cancelled.Task.CurrentNode != domain.NodeCancelled || cancelled.Task.OriginHost != domain.HostZCode || memory.lastMutation.Claim != store.ClaimRelease {
		t.Fatalf("cancelled=%+v mutation=%+v err=%v", cancelled, memory.lastMutation, err)
	}
}
