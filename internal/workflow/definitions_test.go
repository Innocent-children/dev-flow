package workflow

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestStandardDefinitionIsStableAndComplete(t *testing.T) {
	definition := StandardProcess()
	if err := ValidateDefinition(definition); err != nil {
		t.Fatalf("ValidateDefinition: %v", err)
	}
	if got, want := definition.Reference.DefinitionDigest, domain.Digest("53b0fca507664657201ed5b5472c101007897c0f2d7a1e5034d91d322d9bacbe"); got != want {
		t.Fatalf("digest = %s, want %s", got, want)
	}
	wantNodes := []domain.NodeID{domain.NodeRequirements, domain.NodeDesign, domain.NodeTasks, domain.NodeImplement, domain.NodeTest, domain.NodeComprehensionReview, domain.NodeRefactor, domain.NodeDelivery, domain.NodeDone, domain.NodeBlocked, domain.NodeCancelled}
	if len(definition.Nodes) != len(wantNodes) {
		t.Fatalf("nodes=%d", len(definition.Nodes))
	}
	for i, want := range wantNodes {
		if definition.Nodes[i].NodeID != want {
			t.Fatalf("node %d=%s", i, definition.Nodes[i].NodeID)
		}
	}
	if len(definition.Transitions) != 29 {
		t.Fatalf("transitions=%d", len(definition.Transitions))
	}
	for _, node := range definition.Nodes {
		if node.NodeID.Terminal() && len(node.OutgoingTransitions) != 0 {
			t.Fatalf("terminal %s has edges", node.NodeID)
		}
	}
}
func TestDefinitionDigestBindsObservableSemantics(t *testing.T) {
	base := StandardProcess()
	for name, mutate := range map[string]func(*domain.ProcessDefinition){"purpose": func(d *domain.ProcessDefinition) { d.Nodes[0].Purpose += " Updated." }, "condition": func(d *domain.ProcessDefinition) {
		d.Nodes[0].EntryAssumptions = append([]string(nil), d.Nodes[0].EntryAssumptions...)
		d.Nodes[0].EntryAssumptions[0] += " updated"
	}, "transition description": func(d *domain.ProcessDefinition) { d.Transitions[0].Description += " Updated." }} {
		t.Run(name, func(t *testing.T) {
			changed := base
			changed.Nodes = append([]domain.NodeDefinition(nil), base.Nodes...)
			changed.Transitions = append([]domain.TransitionDefinition(nil), base.Transitions...)
			mutate(&changed)
			digest, err := DefinitionDigest(changed)
			if err != nil || digest == base.Reference.DefinitionDigest {
				t.Fatal("observable semantic change did not change digest")
			}
		})
	}
}

func TestWorkflowProductionSourceHasNoLinearRuntimeRegistration(t *testing.T) {
	forbidden := []string{"legacy-linear", "ActionResult", "PhaseIntake", "snapshot-version-1"}
	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".go" || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		contents, err := os.ReadFile(entry.Name())
		if err != nil {
			t.Fatal(err)
		}
		for _, token := range forbidden {
			if strings.Contains(string(contents), token) {
				t.Errorf("%s registers forbidden linear token %q", entry.Name(), token)
			}
		}
	}
}

func TestDefinitionRejectsUnknownDuplicateAndRuntimeAlternates(t *testing.T) {
	definition := StandardProcess()
	definition.Transitions = append(definition.Transitions, definition.Transitions[0])
	if err := definition.Validate(); err == nil {
		t.Fatal("duplicate transition accepted")
	}
	standard := StandardProcess()
	alternate := standard.Reference
	alternate.Version = 2
	if _, err := ResolveDefinition(alternate); err == nil {
		t.Fatal("alternate process accepted")
	}
	action, err := BuildProcessAction(standard, domain.NodeDesign, "task", 1, domain.Digest(strings.Repeat("a", 64)), domain.MethodPlain, "action", time.Date(2026, 8, 19, 1, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if len(action.AvailableTransitions) != 2 || action.AvailableTransitions[0].TransitionID != "design_ready" || action.AvailableTransitions[1].TransitionID != "design_requires_requirements" {
		t.Fatalf("incomplete transitions: %#v", action.AvailableTransitions)
	}
}
