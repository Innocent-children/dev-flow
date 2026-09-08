package application

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestArtifactCollectionPreparationAndMissingSubmission(t *testing.T) {
	ctx := context.Background()
	s, memory, observer := phase5Service(t)
	task := openPhase5Task(t, s)
	paths := []string{"openspec/changes/example/.openspec.yaml", "openspec/changes/example/README.md", "openspec/changes/example/proposal.md", "openspec/changes/example/specs/example/spec.md", "openspec/config.yaml"}
	observer.binding = graphChangedBinding(task.Repository, paths, "c")
	request := CollectArtifactsRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID}
	collection, err := s.CollectArtifacts(ctx, request)
	if err != nil || len(collection.Files) != 5 {
		t.Fatalf("collection=%+v err=%v", collection, err)
	}
	before := memory.commits
	for i := range collection.Files {
		collection.Files[i].Slot, collection.Files[i].Summary = "other_process", "Method support file."
		if i == 2 || i == 3 {
			collection.Files[i].Slot = "current"
		}
	}
	partial := collection
	partial.Files = append([]CollectedArtifact(nil), collection.Files[2:4]...)
	if _, err := s.PrepareArtifacts(ctx, PrepareArtifactsRequest{Host: domain.HostCodex, Collection: partial}); !errors.Is(err, domain.ErrInvalidArgument) || len(domain.ViolationRepositoryPaths(err)) != 3 {
		t.Fatalf("partial collection error=%v", err)
	}
	prepared, err := s.PrepareArtifacts(ctx, PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection})
	if err != nil || prepared.Current == nil || len(*prepared.Current) != 2 || len(prepared.OtherProcess) != 3 {
		t.Fatalf("prepared=%+v err=%v", prepared, err)
	}
	if memory.commits != before || memory.stages != 0 {
		t.Fatal("preparation wrote workflow state")
	}
	submit := requirementsSubmission(t, task, "missing-artifacts")
	submit.CurrentArtifacts = *prepared.Current
	_, err = s.SubmitAction(ctx, submit)
	wantMissing := []string{paths[0], paths[1], paths[4]}
	var failure *domain.Error
	if !errors.As(err, &failure) || !failure.ZeroWrite || !reflect.DeepEqual(domain.ViolationRepositoryPaths(err), wantMissing) {
		t.Fatalf("missing error=%+v", failure)
	}
	if memory.commits != before || memory.stages != 0 {
		t.Fatal("rejection wrote workflow state")
	}
	next, err := s.GetNextAction(ctx, GetNextActionRequest{Host: domain.HostCodex, TaskID: task.TaskID})
	if err != nil || next.Action.ActionID != task.CurrentAction.ActionID || next.Revision != task.Revision {
		t.Fatalf("next=%+v err=%v", next, err)
	}
	submit.OtherProcessArtifacts = prepared.OtherProcess
	result, err := s.SubmitAction(ctx, submit)
	if err != nil || result.Task.CurrentNode != domain.NodeDesign || memory.stages != 1 {
		t.Fatalf("corrected=%+v err=%v", result, err)
	}
	if _, err := s.CollectArtifacts(ctx, request); !errors.Is(err, domain.ErrActionStale) {
		t.Fatalf("stale action=%v", err)
	}
}

func TestArtifactPreparationRejectsChangedFactsAndProductAtRequirements(t *testing.T) {
	ctx := context.Background()
	s, memory, observer := phase5Service(t)
	task := openPhase5Task(t, s)
	observer.binding = graphChangedBinding(task.Repository, []string{"internal/file.go"}, "c")
	r := CollectArtifactsRequest{Host: domain.HostCodex, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID}
	collection, err := s.CollectArtifacts(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	collection.Files[0].Slot, collection.Files[0].Summary = "product", "Product implementation."
	if _, err := s.PrepareArtifacts(ctx, PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection}); !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("product error=%v", err)
	}
	collection.Files[0].Slot = ""
	if _, err := s.PrepareArtifacts(ctx, PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection}); !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("unclassified error=%v", err)
	}
	observer.binding = graphChangedBinding(task.Repository, []string{"internal/file.go"}, "d")
	if _, err := s.PrepareArtifacts(ctx, PrepareArtifactsRequest{Host: domain.HostCodex, Collection: collection}); !errors.Is(err, domain.ErrWorkspaceObservationUnstable) {
		t.Fatalf("changed error=%v", err)
	}
	observer.binding.HistoryRelation = domain.RepositoryHistoryRewind
	if _, err := s.CollectArtifacts(ctx, r); !errors.Is(err, domain.ErrWorkspaceHistoryConflict) {
		t.Fatalf("history error=%v", err)
	}
	observer.binding.HistoryRelation = domain.RepositoryHistoryExact
	observer.binding.WorktreeInstanceDigest = digestOf("e")
	if _, err := s.CollectArtifacts(ctx, r); !errors.Is(err, domain.ErrWorkspaceUnavailable) {
		t.Fatalf("identity error=%v", err)
	}
	if memory.commits != 1 || memory.stages != 0 {
		t.Fatal("failed preparation wrote state")
	}
}
