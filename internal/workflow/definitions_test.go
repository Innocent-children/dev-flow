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
	if got, want := definition.Reference.DefinitionDigest, domain.Digest("193f505f576e73971601d67ca2ed1d6bb44a845590c893af376c50cb74f21954"); got != want {
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
func TestDefinitionDigestIgnoresHumanWording(t *testing.T) {
	for name, mutate := range map[string]func(*domain.ProcessDefinition){
		"node purpose":           func(d *domain.ProcessDefinition) { d.Nodes[0].Purpose += " Updated." },
		"entry wording":          func(d *domain.ProcessDefinition) { d.Nodes[0].EntryAssumptions[0] += " updated" },
		"method purpose":         func(d *domain.ProcessDefinition) { d.Nodes[0].SemanticMethodSteps[0].Purpose += " Updated." },
		"transition description": func(d *domain.ProcessDefinition) { d.Transitions[0].Description += " Updated." },
		"selection condition":    func(d *domain.ProcessDefinition) { d.Transitions[0].SelectionCondition += " Updated." },
	} {
		t.Run(name, func(t *testing.T) {
			changed := StandardProcess()
			want := changed.Reference.DefinitionDigest
			mutate(&changed)
			digest, err := DefinitionDigest(changed)
			if err != nil || digest != want {
				t.Fatalf("wording changed digest: %s != %s", digest, want)
			}
		})
	}
}

func TestDefinitionDigestChangesWithStableSemantics(t *testing.T) {
	for name, mutate := range map[string]func(*domain.ProcessDefinition){
		"node id":       func(d *domain.ProcessDefinition) { d.Nodes[0].NodeID = domain.NodeID("REQUIREMENTS_V2") },
		"transition id": func(d *domain.ProcessDefinition) { d.Transitions[0].TransitionID = "requirements_ready_v2" },
		"guard id":      func(d *domain.ProcessDefinition) { d.Transitions[0].Guard = "requirements_baseline_complete_v2" },
		"reason rule":   func(d *domain.ProcessDefinition) { d.Transitions[0].ReasonRequired = true },
		"node order":    func(d *domain.ProcessDefinition) { d.Nodes[0], d.Nodes[1] = d.Nodes[1], d.Nodes[0] },
		"transition order": func(d *domain.ProcessDefinition) {
			d.Transitions[0], d.Transitions[1] = d.Transitions[1], d.Transitions[0]
		},
	} {
		t.Run(name, func(t *testing.T) {
			changed := StandardProcess()
			wantDifferent := changed.Reference.DefinitionDigest
			mutate(&changed)
			digest, err := DefinitionDigest(changed)
			if err != nil || digest == wantDifferent {
				t.Fatal("stable semantic change did not change digest")
			}
		})
	}
}

func TestDefinitionDigestPersistedActionWordingIsIdentityStable(t *testing.T) {
	now := time.Date(2026, 8, 19, 9, 0, 0, 0, time.UTC)
	bindingDigest := domain.Digest(strings.Repeat("a", 64))
	definition := StandardProcess()
	action, err := BuildProcessAction(definition, domain.NodeRequirements, "task", 1, bindingDigest, domain.MethodPlain, "action", now)
	if err != nil {
		t.Fatal(err)
	}
	action.NodeContract.Purpose = "Capture the current requirements authority."
	action.NodeContract.EntryConditions[0] = "The immutable intent is available."
	action.NodeContract.CompletionConditions[0] = "The goal is defined."
	action.SemanticMethodSteps[0].Purpose = "Capture the bounded requirements."
	action.AvailableTransitions[0].Description = "Continue to design with current requirements."
	action.AvailableTransitions[0].SelectionCondition = "Choose after requirements are complete."
	action.Guidance = "Submit the completed requirements result."
	branch := "main"
	head := strings.Repeat("b", 40)
	task := domain.ProcessTask{
		TaskID: "task", OriginHost: domain.HostCodex,
		Intent:  domain.TaskIntent{Request: "Build feature", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain},
		Process: definition.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action,
		Repository: domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: bindingDigest, RepositoryIdentity: bindingDigest, Branch: &branch, Head: &head, WorktreeFingerprint: bindingDigest, ObservedAt: now, BindingDigest: bindingDigest},
		Revision:   1, CreatedAt: now, UpdatedAt: now,
	}
	if err := ValidateProcessTask(task); err != nil {
		t.Fatalf("human wording changed process identity: %v", err)
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
