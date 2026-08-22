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
	if got, want := definition.Reference.DefinitionDigest, domain.Digest("c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57"); got != want {
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
func TestSemanticMethodCatalogExact(t *testing.T) {
	expected := map[domain.NodeID][]domain.SemanticMethodStep{
		domain.NodeRequirements: {
			{StepID: "requirements.capture", Purpose: "Capture a bounded goal, scope, exclusions, acceptance criteria, constraints, and assumptions.", Required: true},
			{StepID: "requirements.clarify", Purpose: "Resolve material requirement questions with the developer.", Required: true},
			{StepID: "requirements.validate", Purpose: "Verify that requirements are observable, bounded, and free of material ambiguity.", Required: true},
		},
		domain.NodeDesign: {
			{StepID: "design.choose_approach", Purpose: "Select the simplest viable approach for the current requirements.", Required: true},
			{StepID: "design.review_complexity", Purpose: "Identify unnecessary abstractions and justify retained complexity.", Required: true},
			{StepID: "design.record_decisions", Purpose: "Record components, decisions, rejected alternatives, and risks.", Required: true},
		},
		domain.NodeTasks: {
			{StepID: "tasks.decompose", Purpose: "Decompose the current design into bounded, ordered work items.", Required: true},
			{StepID: "tasks.map_acceptance", Purpose: "Map every current acceptance criterion to work and verification.", Required: true},
			{StepID: "tasks.analyze_consistency", Purpose: "Check requirements, design, and tasks for gaps or contradictions.", Required: true},
		},
		domain.NodeImplement: {
			{StepID: "implementation.execute_plan", Purpose: "Execute only the work authorized by the current task plan.", Required: true},
			{StepID: "implementation.record_surface", Purpose: "Record exact changed paths or the no-change state and deviations.", Required: true},
			{StepID: "implementation.classify_deviations", Purpose: "Classify implementation deviations as requirement, design, or complexity concerns.", Required: true},
		},
		domain.NodeTest: {
			{StepID: "test.run_budgeted_checks", Purpose: "Run only verification authorized by the current verification budget.", Required: true},
			{StepID: "test.record_evidence", Purpose: "Record actual evidence sources, outcomes, and unverified or manual items.", Required: true},
			{StepID: "test.classify_failure", Purpose: "Classify failures as implementation, design, or requirement problems.", Required: true},
		},
		domain.NodeComprehensionReview: {
			{StepID: "comprehension.explain", Purpose: "Explain the current behavior, design, and code path in developer-readable terms.", Required: true},
			{StepID: "comprehension.identify_complexity", Purpose: "Identify unnecessary abstractions and maintenance risks.", Required: true},
			{StepID: "comprehension.obtain_user_verdict", Purpose: "Obtain the developer's explicit understanding or remediation verdict.", Required: true},
		},
		domain.NodeRefactor: {
			{StepID: "refactor.simplify", Purpose: "Remove unnecessary complexity within the approved behavior boundary.", Required: true},
			{StepID: "refactor.reconcile_artifacts", Purpose: "Reconcile affected process artifacts with the simplification.", Required: true},
			{StepID: "refactor.record_surface", Purpose: "Record exact simplifications and the changed surface.", Required: true},
		},
		domain.NodeDelivery: {
			{StepID: "delivery.reconcile_acceptance", Purpose: "Map the latest acceptance criteria to current test and comprehension evidence.", Required: true},
			{StepID: "delivery.reconcile_method_artifacts", Purpose: "Reconcile method artifacts with the delivered behavior.", Required: true},
			{StepID: "delivery.prepare_summary", Purpose: "Prepare a bounded delivery summary and remaining risks.", Required: true},
		},
	}
	definition := StandardProcess()
	normalNodes, stepCount := 0, 0
	seen := map[domain.MethodStepID]bool{}
	for _, node := range definition.Nodes {
		if node.NodeID.Normal() {
			normalNodes++
			want := expected[node.NodeID]
			if !slicesEqual(node.SemanticMethodSteps, want) {
				t.Fatalf("%s steps=%#v want=%#v", node.NodeID, node.SemanticMethodSteps, want)
			}
			for _, step := range node.SemanticMethodSteps {
				if seen[step.StepID] || strings.Contains(strings.ToLower(step.Purpose), "speckit") || strings.Contains(strings.ToLower(step.Purpose), "openspec") || strings.Contains(strings.ToLower(step.Purpose), "codex") {
					t.Fatalf("invalid or duplicate semantic step %#v", step)
				}
				seen[step.StepID] = true
				stepCount++
			}
		}
		if node.NodeID.Terminal() && len(node.SemanticMethodSteps) != 0 {
			t.Fatalf("terminal %s has method steps", node.NodeID)
		}
	}
	if normalNodes != 8 || stepCount != 24 || len(seen) != 24 || len(standardMethodStepPurposes) != 24 {
		t.Fatalf("normal nodes=%d steps=%d unique=%d purposes=%d", normalNodes, stepCount, len(seen), len(standardMethodStepPurposes))
	}
	blocked, err := NodeDefinition(definition, domain.NodeBlocked)
	if err != nil || len(blocked.SemanticMethodSteps) != 1 || blocked.SemanticMethodSteps[0].StepID != "blocker.resolve" || seen[blocked.SemanticMethodSteps[0].StepID] {
		t.Fatalf("blocked method step mixed into normal catalog: %#v err=%v", blocked.SemanticMethodSteps, err)
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
		"node id":       func(d *domain.ProcessDefinition) { d.Nodes[0].NodeID = domain.NodeID("REQUIREMENTS_CHANGED") },
		"transition id": func(d *domain.ProcessDefinition) { d.Transitions[0].TransitionID = "requirements_ready_changed" },
		"guard id":      func(d *domain.ProcessDefinition) { d.Transitions[0].Guard = "requirements_baseline_complete_changed" },
		"reason rule":   func(d *domain.ProcessDefinition) { d.Transitions[0].ReasonRequired = true },
		"method step id": func(d *domain.ProcessDefinition) {
			d.Nodes[0].SemanticMethodSteps[0].StepID = "requirements.capture_changed"
		},
		"method required": func(d *domain.ProcessDefinition) { d.Nodes[0].SemanticMethodSteps[0].Required = false },
		"method order": func(d *domain.ProcessDefinition) {
			d.Nodes[0].SemanticMethodSteps[0], d.Nodes[0].SemanticMethodSteps[1] = d.Nodes[0].SemanticMethodSteps[1], d.Nodes[0].SemanticMethodSteps[0]
		},
		"node order": func(d *domain.ProcessDefinition) { d.Nodes[0], d.Nodes[1] = d.Nodes[1], d.Nodes[0] },
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
	alternate.DefinitionDigest = domain.Digest(strings.Repeat("f", 64))
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
