package comprehensive_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestProcessGraphExhaustiveTopologyAndInvalidTransitions(t *testing.T) {
	definition := workflow.StandardProcess()
	if err := workflow.ValidateDefinition(definition); err != nil {
		t.Fatal(err)
	}

	transitions := make(map[domain.TransitionID]domain.TransitionDefinition, len(definition.Transitions))
	for _, transition := range definition.Transitions {
		if _, exists := transitions[transition.TransitionID]; exists {
			t.Fatalf("duplicate transition %s", transition.TransitionID)
		}
		transitions[transition.TransitionID] = transition
		if transition.Source.Terminal() || transition.Destination == "" || transition.Guard == "" {
			t.Fatalf("incomplete transition %#v", transition)
		}
	}

	activeNodes := 0
	validPairs := 0
	invalidPairs := 0
	for _, node := range definition.Nodes {
		declared := make(map[domain.TransitionID]domain.TransitionDefinition, len(node.OutgoingTransitions))
		for _, transition := range node.OutgoingTransitions {
			if transition.Source != node.NodeID {
				t.Fatalf("%s owns transition sourced at %s", node.NodeID, transition.Source)
			}
			canonical, exists := transitions[transition.TransitionID]
			if !exists || canonical != transition {
				t.Fatalf("node transition %s diverges from process catalog", transition.TransitionID)
			}
			declared[transition.TransitionID] = transition
		}
		if len(node.OutgoingTransitions) == 0 {
			continue
		}
		activeNodes++
		action, err := workflow.BuildProcessAction(
			definition,
			node.NodeID,
			"task-comprehensive",
			1,
			domain.Digest("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
			domain.MethodPlain,
			"action-comprehensive",
			time.Unix(1, 0).UTC(),
		)
		if err != nil {
			t.Fatalf("build action for %s: %v", node.NodeID, err)
		}
		if action.Kind != node.ActionKind || action.PayloadContract != node.PayloadContract || len(action.AvailableTransitions) != len(node.OutgoingTransitions) {
			t.Fatalf("action projection diverges for %s", node.NodeID)
		}

		for _, transition := range definition.Transitions {
			resolved, err := workflow.TransitionFor(definition, node.NodeID, transition.TransitionID)
			_, allowed := declared[transition.TransitionID]
			if allowed {
				validPairs++
				if err != nil || resolved != transition {
					t.Fatalf("allowed transition %s rejected at %s", transition.TransitionID, node.NodeID)
				}
				continue
			}
			invalidPairs++
			if err == nil {
				t.Fatalf("transition %s incorrectly allowed at %s", transition.TransitionID, node.NodeID)
			}
		}
	}

	if activeNodes != 8 || len(definition.Nodes) != 11 || len(definition.Transitions) != 30 {
		t.Fatalf("nodes=%d active=%d transitions=%d", len(definition.Nodes), activeNodes, len(definition.Transitions))
	}
	if validPairs != len(definition.Transitions) || invalidPairs != activeNodes*len(definition.Transitions)-validPairs {
		t.Fatalf("valid pairs=%d invalid pairs=%d", validPairs, invalidPairs)
	}
	if invalidPairs != 210 {
		t.Fatalf("expected 210 illegal node/transition combinations, got %d", invalidPairs)
	}
}

func TestProcessGraphDigestRejectsAuthorityMutation(t *testing.T) {
	original := workflow.StandardProcess()
	first, err := workflow.DefinitionDigest(original)
	if err != nil {
		t.Fatal(err)
	}
	second, err := workflow.DefinitionDigest(original)
	if err != nil || first != second || first != original.Reference.DefinitionDigest {
		t.Fatal("process digest is not deterministic")
	}

	mutations := map[string]func(*domain.ProcessDefinition){
		"transition destination": func(definition *domain.ProcessDefinition) {
			definition.Transitions[0].Destination = domain.NodeDone
		},
		"transition guard": func(definition *domain.ProcessDefinition) {
			definition.Transitions[0].Guard = "changed_guard"
		},
		"transition reason rule": func(definition *domain.ProcessDefinition) {
			definition.Transitions[0].ReasonRequired = !definition.Transitions[0].ReasonRequired
		},
		"node action kind": func(definition *domain.ProcessDefinition) {
			definition.Nodes[0].ActionKind = domain.ActionCompleteDesign
		},
		"node allowed effect": func(definition *domain.ProcessDefinition) {
			definition.Nodes[0].AllowedEffects[0] = domain.EffectRunVerificationCommands
		},
		"node evidence": func(definition *domain.ProcessDefinition) {
			definition.Nodes[0].RequiredEvidence[0].Required = false
		},
		"node method step": func(definition *domain.ProcessDefinition) {
			definition.Nodes[0].SemanticMethodSteps[0].Required = false
		},
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			definition := cloneDefinition(t, original)
			mutate(&definition)
			digest, err := workflow.DefinitionDigest(definition)
			if err != nil {
				t.Fatal(err)
			}
			if digest == original.Reference.DefinitionDigest {
				t.Fatal("authority mutation did not change the definition digest")
			}
			if workflow.ValidateDefinition(definition) == nil {
				t.Fatal("definition accepted a mutation under the old digest")
			}
		})
	}
}

func TestProcessGraphTerminalAndBlockedActionBoundary(t *testing.T) {
	definition := workflow.StandardProcess()
	binding := domain.Digest("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	for _, nodeID := range []domain.NodeID{domain.NodeDone, domain.NodeCancelled} {
		if _, err := workflow.BuildProcessAction(definition, nodeID, "task-terminal", 1, binding, domain.MethodPlain, "action-terminal", time.Unix(1, 0).UTC()); err == nil {
			t.Fatalf("terminal node %s produced an action", nodeID)
		}
	}
	blocked, err := workflow.BuildProcessAction(definition, domain.NodeBlocked, "task-blocked", 1, binding, domain.MethodPlain, "action-blocked", time.Unix(1, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	if blocked.Kind != domain.ActionResolveBlocker || len(blocked.AvailableTransitions) != 0 || blocked.PayloadContract != "blocker-resolution" {
		t.Fatalf("blocked action projection=%#v", blocked)
	}
}

func cloneDefinition(t *testing.T, definition domain.ProcessDefinition) domain.ProcessDefinition {
	t.Helper()
	raw, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}
	var clone domain.ProcessDefinition
	if err := json.Unmarshal(raw, &clone); err != nil {
		t.Fatal(err)
	}
	return clone
}
