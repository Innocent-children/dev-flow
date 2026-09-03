package workflow

import (
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestControlCenterProjectionCP1(t *testing.T) {
	now := time.Date(2026, 8, 26, 9, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	definition := StandardProcess()
	transition := func(revision uint64, id domain.TransitionID, source, destination domain.NodeID) CommittedTraversal {
		return CommittedTraversal{Revision: revision, Kind: domain.OperationApplyAction, Source: source, Destination: destination, TransitionID: &id, CreatedAt: now.Add(time.Duration(revision) * time.Minute)}
	}
	open := CommittedTraversal{Revision: 1, Kind: domain.OperationOpenTask, Source: domain.NodeRequirements, Destination: domain.NodeRequirements, CreatedAt: now}
	makeTask := func(node domain.NodeID, revision uint64) domain.ProcessTask {
		action, err := BuildProcessActionForWorkspace(definition, node, "task", revision, domain.WorkspaceDigests{Binding: digest, Identity: digest, History: digest, Content: digest}, domain.MethodPlain, "action", now)
		if err != nil {
			t.Fatal(err)
		}
		return domain.ProcessTask{TaskID: "task", Process: definition.Reference, CurrentNode: node, CurrentAction: &action, Revision: revision}
	}

	cases := []struct {
		name       string
		task       domain.ProcessTask
		events     []CommittedTraversal
		wantSafe   bool
		assertions func(*testing.T, ControlCenterGraph)
	}{
		{
			name: "resolved graph and current legal paths",
			task: makeTask(domain.NodeTasks, 3),
			events: []CommittedTraversal{open,
				transition(2, "requirements_ready", domain.NodeRequirements, domain.NodeDesign),
				transition(3, "design_ready", domain.NodeDesign, domain.NodeTasks)},
			wantSafe: true,
			assertions: func(t *testing.T, graph ControlCenterGraph) {
				if len(graph.Nodes) != len(definition.Nodes) || len(graph.Transitions) != len(definition.Transitions) || len(graph.CurrentLegalTransitionIDs) != 3 {
					t.Fatalf("incomplete projection: %#v", graph)
				}
			},
		},
		{
			name: "repeated traversal remains ordered",
			task: makeTask(domain.NodeDesign, 4),
			events: []CommittedTraversal{open,
				transition(2, "requirements_ready", domain.NodeRequirements, domain.NodeDesign),
				withReason(transition(3, "design_requires_requirements", domain.NodeDesign, domain.NodeRequirements), "Requirements changed."),
				transition(4, "requirements_ready", domain.NodeRequirements, domain.NodeDesign)},
			wantSafe: true,
			assertions: func(t *testing.T, graph ControlCenterGraph) {
				if len(graph.Traversals) != 4 || *graph.Traversals[1].TransitionID != "requirements_ready" || *graph.Traversals[3].TransitionID != "requirements_ready" {
					t.Fatalf("repeated traversal lost: %#v", graph.Traversals)
				}
			},
		},
		{
			name: "cyclic future reachability terminates",
			task: makeTask(domain.NodeImplement, 4),
			events: []CommittedTraversal{open,
				transition(2, "requirements_ready", domain.NodeRequirements, domain.NodeDesign),
				transition(3, "design_ready", domain.NodeDesign, domain.NodeTasks),
				transition(4, "tasks_ready", domain.NodeTasks, domain.NodeImplement)},
			wantSafe: true,
			assertions: func(t *testing.T, graph ControlCenterGraph) {
				if len(graph.FutureNodeIDs) > len(definition.Nodes)-1 || len(graph.FutureTransitionIDs) > len(definition.Transitions) {
					t.Fatalf("cycle traversal was not bounded: nodes=%d transitions=%d", len(graph.FutureNodeIDs), len(graph.FutureTransitionIDs))
				}
			},
		},
		{
			name:     "inconsistent revision safe stops",
			task:     makeTask(domain.NodeDesign, 2),
			events:   []CommittedTraversal{open, transition(3, "requirements_ready", domain.NodeRequirements, domain.NodeDesign)},
			wantSafe: false,
		},
		{
			name: "unknown definition safe stops",
			task: func() domain.ProcessTask {
				task := makeTask(domain.NodeRequirements, 1)
				task.Process.DefinitionDigest = domain.Digest(strings.Repeat("b", 64))
				return task
			}(),
			events:   []CommittedTraversal{open},
			wantSafe: false,
		},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			graph := ProjectControlCenterGraph(test.task, test.events)
			if graph.Safe != test.wantSafe {
				t.Fatalf("Safe=%v want %v", graph.Safe, test.wantSafe)
			}
			if !graph.Safe && (len(graph.CurrentLegalTransitionIDs) != 0 || len(graph.FutureTransitionIDs) != 0) {
				t.Fatalf("unsafe graph exposed actionable paths: %#v", graph)
			}
			if test.assertions != nil {
				test.assertions(t, graph)
			}
		})
	}
}

func withReason(traversal CommittedTraversal, reason string) CommittedTraversal {
	traversal.Reason = reason
	return traversal
}
