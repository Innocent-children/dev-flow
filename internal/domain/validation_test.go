package domain

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var testTime = time.Date(2026, time.August, 14, 1, 2, 3, 0, time.UTC)

func TestClosedCanonicalVocabulary(t *testing.T) {
	t.Run("hosts", func(t *testing.T) {
		for _, value := range []Host{HostCodex, HostDeepSeek} {
			if !value.IsValid() {
				t.Fatalf("canonical host %q is invalid", value)
			}
		}
		for _, value := range []Host{"", "Codex", " codex ", "claude"} {
			if value.IsValid() {
				t.Fatalf("non-canonical host %q is valid", value)
			}
		}
	})

	t.Run("phases", func(t *testing.T) {
		values := []Phase{
			PhaseIntake, PhaseAssess, PhasePlan, PhaseImplement, PhaseVerify,
			PhaseReview, PhaseHandoff, PhaseDone, PhaseBlocked, PhaseCancelled,
		}
		for _, value := range values {
			if !value.IsValid() {
				t.Fatalf("canonical phase %q is invalid", value)
			}
		}
		for _, value := range []Phase{"", "intake", " INTAKE ", "COMPLETE"} {
			if value.IsValid() {
				t.Fatalf("non-canonical phase %q is valid", value)
			}
		}
		if !PhaseDone.Terminal() || !PhaseCancelled.Terminal() || PhaseBlocked.Terminal() {
			t.Fatal("terminal phase classification is incorrect")
		}
	})

	t.Run("action kinds and results", func(t *testing.T) {
		kinds := []ActionKind{
			ActionAssessTask, ActionPlanChange, ActionImplementChange, ActionVerifyChange,
			ActionReviewChange, ActionPrepareHandoff, ActionResolveBlocker,
		}
		for _, value := range kinds {
			if !value.IsValid() {
				t.Fatalf("canonical action kind %q is invalid", value)
			}
		}
		for _, value := range []ActionKind{"", "assess_task", " REVIEW_CHANGE ", "REVIEW_TASK"} {
			if value.IsValid() {
				t.Fatalf("non-canonical action kind %q is valid", value)
			}
		}

		results := []ActionResult{
			ActionResultSucceeded, ActionResultReady, ActionResultFailed, ActionResultPass,
			ActionResultReworkImplementation, ActionResultReplan, ActionResultComplete,
		}
		for _, value := range results {
			if !value.IsValid() {
				t.Fatalf("canonical action result %q is invalid", value)
			}
		}
		for _, value := range []ActionResult{"", "SUCCEEDED", "approved", "passed-or-accepted", " pass "} {
			if value.IsValid() {
				t.Fatalf("non-canonical action result %q is valid", value)
			}
		}
	})

	t.Run("operation kinds", func(t *testing.T) {
		for _, value := range []OperationKind{
			OperationOpenTask, OperationApplyAction, OperationCancelTask,
		} {
			if !value.IsValid() {
				t.Fatalf("canonical operation kind %q is invalid", value)
			}
		}
		for _, value := range []OperationKind{"", "OPEN_TASK", " apply_action ", "resume_task"} {
			if value.IsValid() {
				t.Fatalf("non-canonical operation kind %q is valid", value)
			}
		}
	})

	t.Run("evidence recovery verification and terminal values", func(t *testing.T) {
		for _, value := range []EvidenceSource{
			EvidenceSourceAutomated, EvidenceSourceUser, EvidenceSourceStatic, EvidenceSourceHostObserved,
		} {
			if !value.IsValid() {
				t.Fatalf("canonical evidence source %q is invalid", value)
			}
		}
		if EvidenceSource("manual").IsValid() || EvidenceSource(" automated ").IsValid() {
			t.Fatal("evidence source alias was accepted")
		}

		for _, value := range []RecoveryClassification{
			RecoveryNotStarted, RecoveryCompletedAndRecorded, RecoveryCompletedButUnrecorded,
			RecoveryPartiallyCompleted, RecoveryConflicting,
		} {
			if !value.IsValid() {
				t.Fatalf("canonical recovery classification %q is invalid", value)
			}
		}
		if RecoveryClassification("completed").IsValid() {
			t.Fatal("recovery classification alias was accepted")
		}

		for _, value := range []VerificationLevel{VerificationMinimal, VerificationTargeted, VerificationFull} {
			if !value.IsValid() {
				t.Fatalf("canonical verification level %q is invalid", value)
			}
		}
		if VerificationLevel("TARGETED").IsValid() {
			t.Fatal("verification level alias was accepted")
		}

		for _, value := range []TerminalStatus{TerminalCompleted, TerminalCancelled} {
			if !value.IsValid() {
				t.Fatalf("canonical terminal status %q is invalid", value)
			}
		}
		if TerminalStatus("done").IsValid() {
			t.Fatal("terminal status alias was accepted")
		}
	})
}

func TestIdentifiersAndDigestsAreCanonicalAndBounded(t *testing.T) {
	if !ID(strings.Repeat("i", MaxIdentifierBytes)).IsValid() {
		t.Fatal("identifier at byte limit is invalid")
	}
	for _, value := range []ID{
		"", ID(strings.Repeat("i", MaxIdentifierBytes+1)), " id", "id ", "id with space",
	} {
		if value.IsValid() {
			t.Fatalf("invalid identifier %q was accepted", value)
		}
	}

	valid := Digest(strings.Repeat("a", sha256.Size*2))
	if !valid.IsValid() {
		t.Fatal("canonical SHA-256 digest is invalid")
	}
	for _, value := range []Digest{
		"", Digest(strings.Repeat("a", sha256.Size*2-1)),
		Digest(strings.Repeat("A", sha256.Size*2)), Digest(strings.Repeat("z", sha256.Size*2)),
	} {
		if value.IsValid() {
			t.Fatalf("invalid digest %q was accepted", value)
		}
	}
}

func TestCompactJSONSizeCountsRequiredEscapingButNotHTMLEscaping(t *testing.T) {
	type projection struct {
		Text string `json:"text"`
	}
	empty, err := compactJSONSize(projection{})
	if err != nil {
		t.Fatal(err)
	}
	html, err := compactJSONSize(projection{Text: "<>&"})
	if err != nil {
		t.Fatal(err)
	}
	required, err := compactJSONSize(projection{Text: "\\\""})
	if err != nil {
		t.Fatal(err)
	}
	if html-empty != 3 {
		t.Fatalf("HTML-sensitive bytes expanded by %d, want 3 literal bytes", html-empty)
	}
	if required-empty != 4 {
		t.Fatalf("backslash and quote encoded as %d bytes, want 4 escaped bytes", required-empty)
	}
}

func TestContractNormalizesOnlyDocumentedTextAndIsImmutable(t *testing.T) {
	scope := []string{"\u2003first scope\u2003", "second scope"}
	outOfScope := []string{" excluded "}
	acceptance := []string{" criterion "}
	budget := VerificationBudget{
		Level:                VerificationTargeted,
		MaxAutomaticCommands: MaxAutomaticVerificationCommands,
		AllowFullSuite:       true,
		AllowManualHandoff:   true,
	}
	contract, err := NewContract("\t goal \n", scope, outOfScope, acceptance, budget)
	if err != nil {
		t.Fatalf("NewContract returned error: %v", err)
	}
	if got := contract.Goal(); got != "goal" {
		t.Fatalf("goal = %q, want %q", got, "goal")
	}
	if got := contract.Scope(); len(got) != len(scope) || got[0] != "first scope" {
		t.Fatalf("scope was not normalized in order: %#v", got)
	}
	if got := contract.OutOfScope(); len(got) != 1 || got[0] != "excluded" {
		t.Fatalf("out-of-scope was not normalized: %#v", got)
	}
	if got := contract.AcceptanceCriteria(); len(got) != 1 || got[0] != "criterion" {
		t.Fatalf("acceptance was not normalized: %#v", got)
	}
	if err := contract.Validate(); err != nil {
		t.Fatalf("normalized contract is invalid: %v", err)
	}

	scope[0] = "mutated input"
	outOfScope[0] = "mutated input"
	acceptance[0] = "mutated input"
	returnedScope := contract.Scope()
	returnedScope[0] = "mutated accessor"
	returnedOut := contract.OutOfScope()
	returnedOut[0] = "mutated accessor"
	returnedAcceptance := contract.AcceptanceCriteria()
	returnedAcceptance[0] = "mutated accessor"
	if contract.Scope()[0] != "first scope" || contract.OutOfScope()[0] != "excluded" ||
		contract.AcceptanceCriteria()[0] != "criterion" {
		t.Fatal("contract slices are externally mutable")
	}

	equal, err := NewContract("goal", []string{"first scope", "second scope"}, []string{"excluded"}, []string{"criterion"}, budget)
	if err != nil || !contract.Equal(equal) {
		t.Fatalf("logically equal contract mismatch: err=%v equal=%v", err, contract.Equal(equal))
	}
}

func TestContractCoreLimitBoundariesAndDuplicates(t *testing.T) {
	validBudget := VerificationBudget{
		Level:                VerificationMinimal,
		MaxAutomaticCommands: MaxAutomaticVerificationCommands,
	}

	if _, err := NewContract(strings.Repeat("g", MaxGoalBytes), nil, nil, []string{"criterion"}, validBudget); err != nil {
		t.Fatalf("goal at byte limit rejected: %v", err)
	}
	if _, err := NewContract(strings.Repeat("g", MaxGoalBytes+1), nil, nil, []string{"criterion"}, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("oversized goal error = %v, want INVALID_ARGUMENT", err)
	}

	maxScope := uniqueStrings("scope", MaxScopeItems)
	maxScope[0] = strings.Repeat("s", MaxScopeItemBytes)
	if _, err := NewContract("goal", maxScope, nil, []string{"criterion"}, validBudget); err != nil {
		t.Fatalf("scope at item and byte limits rejected: %v", err)
	}
	if _, err := NewContract("goal", uniqueStrings("scope", MaxScopeItems+1), nil, []string{"criterion"}, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("too many scope items error = %v, want INVALID_ARGUMENT", err)
	}
	if _, err := NewContract("goal", []string{strings.Repeat("s", MaxScopeItemBytes+1)}, nil, []string{"criterion"}, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("oversized scope item error = %v, want INVALID_ARGUMENT", err)
	}

	maxOut := uniqueStrings("excluded", MaxOutOfScopeItems)
	maxOut[0] = strings.Repeat("o", MaxOutOfScopeItemBytes)
	if _, err := NewContract("goal", nil, maxOut, []string{"criterion"}, validBudget); err != nil {
		t.Fatalf("out-of-scope at item and byte limits rejected: %v", err)
	}
	if _, err := NewContract("goal", nil, uniqueStrings("excluded", MaxOutOfScopeItems+1), []string{"criterion"}, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("too many out-of-scope items error = %v, want INVALID_ARGUMENT", err)
	}

	maxAcceptance := uniqueStrings("criterion", MaxAcceptanceCriteriaItems)
	maxAcceptance[0] = strings.Repeat("a", MaxAcceptanceCriterionBytes)
	if _, err := NewContract("goal", nil, nil, maxAcceptance, validBudget); err != nil {
		t.Fatalf("acceptance at item and byte limits rejected: %v", err)
	}
	if _, err := NewContract("goal", nil, nil, nil, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("empty acceptance error = %v, want INVALID_ARGUMENT", err)
	}
	if _, err := NewContract("goal", nil, nil, uniqueStrings("criterion", MaxAcceptanceCriteriaItems+1), validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("too many acceptance items error = %v, want INVALID_ARGUMENT", err)
	}
	if _, err := NewContract("goal", nil, nil, []string{strings.Repeat("a", MaxAcceptanceCriterionBytes+1)}, validBudget); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("oversized acceptance item error = %v, want INVALID_ARGUMENT", err)
	}

	for _, tc := range []struct {
		name       string
		scope      []string
		outOfScope []string
		acceptance []string
	}{
		{name: "scope duplicate after trim", scope: []string{"same", " same "}, acceptance: []string{"criterion"}},
		{name: "out-of-scope duplicate after trim", outOfScope: []string{"same", "\u2003same\u2003"}, acceptance: []string{"criterion"}},
		{name: "acceptance duplicate after trim", acceptance: []string{"same", " same "}},
		{name: "empty scope item", scope: []string{" "}, acceptance: []string{"criterion"}},
		{name: "invalid UTF-8", scope: []string{string([]byte{0xff})}, acceptance: []string{"criterion"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := NewContract("goal", tc.scope, tc.outOfScope, tc.acceptance, validBudget); !errors.Is(err, ErrInvalidArgument) {
				t.Fatalf("error = %v, want INVALID_ARGUMENT", err)
			}
		})
	}

	t.Run("encoded aggregate counts JSON escaping", func(t *testing.T) {
		nearLimit := escapedUniqueStrings(MaxAcceptanceCriteriaItems-1, MaxAcceptanceCriterionBytes)
		contract, err := NewContract("goal", nil, nil, nearLimit, validBudget)
		if err != nil {
			t.Fatalf("near-limit escaped contract rejected: %v", err)
		}
		size, err := contractAggregateSize(contract)
		if err != nil || size > MaxContractAggregateBytes {
			t.Fatalf("near-limit contract size = %d, err = %v", size, err)
		}

		overLimit := escapedUniqueStrings(MaxAcceptanceCriteriaItems, MaxAcceptanceCriterionBytes)
		if _, err := NewContract("goal", nil, nil, overLimit, validBudget); !errors.Is(err, ErrInvalidArgument) {
			t.Fatalf("escaped contract above aggregate limit error = %v, want INVALID_ARGUMENT", err)
		}
	})
}

func TestVerificationBudgetBoundariesAndAliases(t *testing.T) {
	for _, commands := range []int{0, MaxAutomaticVerificationCommands} {
		budget := VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: commands}
		if err := budget.Validate(); err != nil {
			t.Fatalf("command boundary %d rejected: %v", commands, err)
		}
	}
	for _, budget := range []VerificationBudget{
		{Level: VerificationLevel("TARGETED")},
		{Level: VerificationTargeted, MaxAutomaticCommands: -1},
		{Level: VerificationTargeted, MaxAutomaticCommands: MaxAutomaticVerificationCommands + 1},
	} {
		if !errors.Is(budget.Validate(), ErrInvalidArgument) {
			t.Fatalf("invalid budget %#v was accepted", budget)
		}
	}
}

func TestRepositoryBindingInvariants(t *testing.T) {
	normal := validRepositoryBinding()
	if err := normal.Validate(); err != nil {
		t.Fatalf("valid repository binding rejected: %v", err)
	}

	unborn := normal
	unborn.Head = nil
	unborn.Unborn = true
	if err := unborn.Validate(); err != nil {
		t.Fatalf("valid unborn repository rejected: %v", err)
	}

	detached := normal
	detached.Branch = nil
	detached.Detached = true
	if err := detached.Validate(); err != nil {
		t.Fatalf("valid detached repository rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*RepositoryBinding)
	}{
		{name: "detached with branch", mutate: func(b *RepositoryBinding) { b.Detached = true }},
		{name: "attached without branch", mutate: func(b *RepositoryBinding) { b.Branch = nil }},
		{name: "unborn with head", mutate: func(b *RepositoryBinding) { b.Unborn = true }},
		{name: "unborn detached", mutate: func(b *RepositoryBinding) { b.Unborn = true; b.Head = nil; b.Detached = true; b.Branch = nil }},
		{name: "born without head", mutate: func(b *RepositoryBinding) { b.Head = nil }},
		{name: "noncanonical head", mutate: func(b *RepositoryBinding) { value := strings.Repeat("A", 40); b.Head = &value }},
		{name: "relative root", mutate: func(b *RepositoryBinding) { b.CanonicalRoot = "relative/repo" }},
		{name: "unclean root", mutate: func(b *RepositoryBinding) {
			b.CanonicalRoot += string(filepath.Separator) + "child" + string(filepath.Separator) + ".."
		}},
		{name: "oversized root", mutate: func(b *RepositoryBinding) {
			b.CanonicalRoot = string(filepath.Separator) + strings.Repeat("r", MaxRepositoryPathBytes)
		}},
		{name: "trimmed branch alias", mutate: func(b *RepositoryBinding) { value := " main "; b.Branch = &value }},
		{name: "uppercase digest", mutate: func(b *RepositoryBinding) { b.BindingDigest = Digest(strings.Repeat("A", sha256.Size*2)) }},
		{name: "zero observation time", mutate: func(b *RepositoryBinding) { b.ObservedAt = time.Time{} }},
		{name: "non-UTC observation time", mutate: func(b *RepositoryBinding) { b.ObservedAt = testTime.In(time.FixedZone("offset", 60*60)) }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := normal.Clone()
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid repository binding was accepted: %#v", candidate)
			}
		})
	}

	clone := normal.Clone()
	*clone.Branch = "mutated"
	*clone.Head = strings.Repeat("b", 40)
	if *normal.Branch != "main" || *normal.Head != strings.Repeat("a", 40) {
		t.Fatal("repository clone retained pointer aliases")
	}
}

func TestActionInvariantsAndCopies(t *testing.T) {
	action := validAction()
	if err := action.Validate(); err != nil {
		t.Fatalf("valid action rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*Action)
	}{
		{name: "missing action ID", mutate: func(a *Action) { a.ActionID = "" }},
		{name: "identifier alias", mutate: func(a *Action) { a.ActionID = " action-1 " }},
		{name: "unknown action kind", mutate: func(a *Action) { a.Kind = "assess_task" }},
		{name: "missing payload contract", mutate: func(a *Action) { a.PayloadContract = "" }},
		{name: "terminal payload contract", mutate: func(a *Action) { a.PayloadContract = PhaseDone }},
		{name: "zero revision", mutate: func(a *Action) { a.Revision = 0 }},
		{name: "bad binding digest", mutate: func(a *Action) { a.RepositoryBindingDigest = "sha256" }},
		{name: "empty guidance", mutate: func(a *Action) { a.Guidance = "" }},
		{name: "unnormalized guidance", mutate: func(a *Action) { a.Guidance = " guidance " }},
		{name: "oversized guidance", mutate: func(a *Action) { a.Guidance = strings.Repeat("g", MaxGuidanceBytes+1) }},
		{name: "missing allowed effects", mutate: func(a *Action) { a.AllowedEffects = nil }},
		{name: "duplicate effect", mutate: func(a *Action) { a.AllowedEffects = append(a.AllowedEffects, a.AllowedEffects[0]) }},
		{name: "unknown effect", mutate: func(a *Action) { a.AllowedEffects = []AllowedEffect{"write_git_history"} }},
		{name: "missing evidence requirements", mutate: func(a *Action) { a.RequiredEvidence = nil }},
		{name: "too many evidence requirements", mutate: func(a *Action) {
			a.RequiredEvidence = make([]EvidenceRequirement, MaxEvidencePerAction+1)
			for i := range a.RequiredEvidence {
				a.RequiredEvidence[i] = EvidenceRequirement{Kind: RequirementRepositoryObservation, Required: true}
			}
		}},
		{name: "duplicate evidence requirement", mutate: func(a *Action) { a.RequiredEvidence = append(a.RequiredEvidence, a.RequiredEvidence[0]) }},
		{name: "unknown evidence requirement", mutate: func(a *Action) { a.RequiredEvidence = []EvidenceRequirement{{Kind: "raw_output", Required: true}} }},
		{name: "zero issue time", mutate: func(a *Action) { a.IssuedAt = time.Time{} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := action.Clone()
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid action was accepted: %#v", candidate)
			}
		})
	}

	clone := action.Clone()
	clone.AllowedEffects[0] = EffectEditRepositoryFiles
	clone.RequiredEvidence[0].Kind = RequirementDeliverySummary
	if action.AllowedEffects[0] != EffectReadRepository ||
		action.RequiredEvidence[0].Kind != RequirementRepositoryObservation {
		t.Fatal("action clone retained slice aliases")
	}
}

func TestEvidenceSummaryInvariantsAndLimits(t *testing.T) {
	evidence := validEvidence("evidence-1", EvidenceSourceAutomated, 1)
	if err := evidence.Validate(); err != nil {
		t.Fatalf("valid evidence rejected: %v", err)
	}
	boundary := evidence
	boundary.Name = strings.Repeat("n", MaxEvidenceNameBytes)
	boundary.Summary = strings.Repeat("s", MaxEvidenceSummaryBytes)
	boundary.CommandCount = MaxAutomaticVerificationCommands
	if err := boundary.Validate(); err != nil {
		t.Fatalf("evidence at limits rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*EvidenceSummary)
	}{
		{name: "unknown source", mutate: func(e *EvidenceSummary) { e.Source = "manual" }},
		{name: "unknown status", mutate: func(e *EvidenceSummary) { e.Status = "success" }},
		{name: "oversized name", mutate: func(e *EvidenceSummary) { e.Name = strings.Repeat("n", MaxEvidenceNameBytes+1) }},
		{name: "oversized summary", mutate: func(e *EvidenceSummary) { e.Summary = strings.Repeat("s", MaxEvidenceSummaryBytes+1) }},
		{name: "unnormalized summary", mutate: func(e *EvidenceSummary) { e.Summary = " summary " }},
		{name: "negative command count", mutate: func(e *EvidenceSummary) { e.CommandCount = -1 }},
		{name: "too many commands", mutate: func(e *EvidenceSummary) { e.CommandCount = MaxAutomaticVerificationCommands + 1 }},
		{name: "nonautomated commands", mutate: func(e *EvidenceSummary) { e.Source = EvidenceSourceStatic; e.CommandCount = 1 }},
		{name: "nonautomated full suite", mutate: func(e *EvidenceSummary) { e.Source = EvidenceSourceUser; e.CommandCount = 0; e.FullSuite = true }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := evidence
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid evidence was accepted: %#v", candidate)
			}
		})
	}
}

func TestOutcomeInvariantsAndCopies(t *testing.T) {
	outcome := validOutcome(TerminalCompleted, []string{"criterion"})
	outcome.AutomatedEvidenceIDs = []ID{"auto"}
	outcome.ManualEvidenceIDs = []ID{"manual"}
	if err := outcome.Validate(); err != nil {
		t.Fatalf("valid outcome rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*Outcome)
	}{
		{name: "unknown status", mutate: func(o *Outcome) { o.Status = "done" }},
		{name: "empty acceptance", mutate: func(o *Outcome) { o.Acceptance = nil }},
		{name: "duplicate criterion", mutate: func(o *Outcome) { o.Acceptance = append(o.Acceptance, o.Acceptance[0]) }},
		{name: "criterion alias", mutate: func(o *Outcome) { o.Acceptance[0].Criterion = " criterion " }},
		{name: "noncanonical automated evidence ID", mutate: func(o *Outcome) { o.AutomatedEvidenceIDs[0] = " auto " }},
		{name: "duplicate automated evidence ID", mutate: func(o *Outcome) {
			o.AutomatedEvidenceIDs = append(o.AutomatedEvidenceIDs, o.AutomatedEvidenceIDs[0])
		}},
		{name: "duplicate evidence ID across lists", mutate: func(o *Outcome) {
			o.ManualEvidenceIDs[0] = o.AutomatedEvidenceIDs[0]
		}},
		{name: "duplicate risk after normalization", mutate: func(o *Outcome) { o.Risks = []string{"risk", " risk "} }},
		{name: "too many unverified items", mutate: func(o *Outcome) { o.UnverifiedItems = uniqueStrings("item", MaxBoundedStringListItems+1) }},
		{name: "oversized summary", mutate: func(o *Outcome) { o.Summary = strings.Repeat("s", MaxOutcomeSummaryBytes+1) }},
		{name: "bad final binding digest", mutate: func(o *Outcome) { o.FinalRepositoryBindingDigest = "bad" }},
		{name: "zero completion time", mutate: func(o *Outcome) { o.CompletedAt = time.Time{} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := outcome.Clone()
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid outcome was accepted: %#v", candidate)
			}
		})
	}

	t.Run("narrative aggregate counts JSON escaping", func(t *testing.T) {
		candidate := outcome.Clone()
		candidate.Risks = escapedUniqueStrings(15, MaxReasonBytes)
		if err := candidate.Validate(); err != nil {
			t.Fatalf("near-limit escaped outcome narrative rejected: %v", err)
		}
		size, err := outcomeNarrativeAggregateSize(candidate)
		if err != nil || size > MaxOutcomeNarrativeAggregateBytes {
			t.Fatalf("near-limit outcome narrative size = %d, err = %v", size, err)
		}
		candidate.Risks = escapedUniqueStrings(16, MaxReasonBytes)
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("outcome narrative above aggregate limit was accepted")
		}
	})

	clone := outcome.Clone()
	clone.Acceptance[0].Criterion = "mutated"
	clone.AutomatedEvidenceIDs[0] = "mutated-auto"
	clone.ManualEvidenceIDs[0] = "mutated-manual"
	clone.UnverifiedItems[0] = "mutated"
	clone.Risks[0] = "mutated"
	if outcome.Acceptance[0].Criterion != "criterion" || outcome.AutomatedEvidenceIDs[0] != "auto" ||
		outcome.ManualEvidenceIDs[0] != "manual" ||
		outcome.UnverifiedItems[0] != "none" || outcome.Risks[0] != "risk" {
		t.Fatal("outcome clone retained slice aliases")
	}
}

func TestTaskNormalBlockedAndTerminalShapes(t *testing.T) {
	normal := validTask(t)
	if err := normal.Validate(); err != nil {
		t.Fatalf("valid normal task rejected: %v", err)
	}

	blocked := normal.Clone()
	blocked.Phase = PhaseBlocked
	resume := PhasePlan
	blocked.ResumePhase = &resume
	blocked.CurrentAction.Kind = ActionResolveBlocker
	blocked.CurrentAction.PayloadContract = PhaseBlocked
	blocked.Blocker = &Blocker{
		BlockerID:             "blocker-1",
		Code:                  ErrorTaskBlocked,
		Cause:                 RecoveryConflicting,
		Message:               "repository state needs review",
		ResumePhase:           resume,
		ObservedBindingDigest: blocked.Repository.BindingDigest,
		Condition: BlockerCondition{
			Kind:                  BlockerConditionRestoreIssuanceBinding,
			ExpectedBindingDigest: blocked.Repository.BindingDigest,
		},
		RequiredResolution: "restore the expected repository identity",
		CreatedAt:          testTime,
	}
	if err := blocked.Validate(); err != nil {
		t.Fatalf("valid blocked task rejected: %v", err)
	}

	t.Run("blocker text boundaries", func(t *testing.T) {
		candidate := *blocked.Blocker
		candidate.Message = strings.Repeat("m", MaxBlockerMessageBytes)
		candidate.RequiredResolution = strings.Repeat("r", MaxResolutionTextBytes)
		if err := candidate.Validate(); err != nil {
			t.Fatalf("blocker at text limits rejected: %v", err)
		}
		candidate.Message += "m"
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("oversized blocker message was accepted")
		}
		candidate = *blocked.Blocker
		candidate.RequiredResolution = strings.Repeat("r", MaxResolutionTextBytes+1)
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("oversized blocker resolution was accepted")
		}
	})

	done := terminalTask(t, TerminalCompleted)
	if err := done.Validate(); err != nil {
		t.Fatalf("valid completed task rejected: %v", err)
	}
	cancelled := terminalTask(t, TerminalCancelled)
	if err := cancelled.Validate(); err != nil {
		t.Fatalf("valid cancelled task rejected: %v", err)
	}

	t.Run("normal task rejects terminal or blocker fields", func(t *testing.T) {
		candidate := normal.Clone()
		candidate.CurrentAction = nil
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("normal task without action was accepted")
		}
		candidate = normal.Clone()
		candidate.Blocker = blocked.Blocker
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("normal task with blocker was accepted")
		}
	})

	t.Run("blocked task requires matching blocker and resume phase", func(t *testing.T) {
		candidate := blocked.Clone()
		candidate.Blocker = nil
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("blocked task without blocker was accepted")
		}
		candidate = blocked.Clone()
		other := PhaseAssess
		candidate.ResumePhase = &other
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("blocked task with mismatched resume phase was accepted")
		}
		candidate = blocked.Clone()
		candidate.Blocker.ResumePhase = PhaseDone
		candidate.ResumePhase = &candidate.Blocker.ResumePhase
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("blocked task with terminal resume phase was accepted")
		}
	})

	t.Run("terminal task rejects active fields and mismatched outcome", func(t *testing.T) {
		candidate := done.Clone()
		action := validAction()
		candidate.CurrentAction = &action
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("terminal task with action was accepted")
		}
		candidate = done.Clone()
		candidate.Outcome.Status = TerminalCancelled
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("DONE task with cancelled outcome was accepted")
		}
		candidate = done.Clone()
		candidate.CompletedAt = nil
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("terminal task without completion time was accepted")
		}
		candidate = done.Clone()
		candidate.Outcome.FinalRepositoryBindingDigest = testDigest("f")
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("terminal task with stale final repository binding was accepted")
		}
	})
}

func TestTaskAggregateRelationshipsAndVerificationBudget(t *testing.T) {
	task := validTask(t)

	for _, tc := range []struct {
		name   string
		mutate func(*Task)
	}{
		{name: "action task mismatch", mutate: func(v *Task) { v.CurrentAction.TaskID = "other-task" }},
		{name: "action revision mismatch", mutate: func(v *Task) { v.CurrentAction.Revision++ }},
		{name: "action binding mismatch", mutate: func(v *Task) { v.CurrentAction.RepositoryBindingDigest = testDigest("b") }},
		{name: "action payload phase mismatch", mutate: func(v *Task) { v.CurrentAction.PayloadContract = PhaseAssess }},
		{name: "updated before created", mutate: func(v *Task) { v.UpdatedAt = v.CreatedAt.Add(-time.Second) }},
		{name: "duplicate evidence identity", mutate: func(v *Task) {
			evidence := validEvidence("same", EvidenceSourceStatic, 0)
			v.Evidence = []EvidenceSummary{evidence, evidence}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			candidate := task.Clone()
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid task relationship was accepted: %#v", candidate)
			}
		})
	}

	t.Run("retained evidence count boundary", func(t *testing.T) {
		candidate := task.Clone()
		candidate.Evidence = make([]EvidenceSummary, MaxRetainedEvidenceItems)
		for i := range candidate.Evidence {
			candidate.Evidence[i] = validEvidence(ID(fmt.Sprintf("evidence-%d", i)), EvidenceSourceStatic, 0)
		}
		if err := candidate.Validate(); err != nil {
			t.Fatalf("task at retained evidence limit rejected: %v", err)
		}
		candidate.Evidence = append(candidate.Evidence, validEvidence("overflow", EvidenceSourceStatic, 0))
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("task over retained evidence limit was accepted")
		}
	})

	t.Run("automatic command budget", func(t *testing.T) {
		candidate := task.Clone()
		candidate.Evidence = []EvidenceSummary{
			validEvidence("auto-1", EvidenceSourceAutomated, 1),
			validEvidence("auto-2", EvidenceSourceAutomated, 1),
		}
		if err := candidate.Validate(); err != nil {
			t.Fatalf("task at automatic command budget rejected: %v", err)
		}
		candidate.Evidence = append(candidate.Evidence, validEvidence("auto-3", EvidenceSourceAutomated, 1))
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("task over automatic command budget was accepted")
		}
	})

	t.Run("full suite and manual handoff permissions", func(t *testing.T) {
		candidate := task.Clone()
		fullSuite := validEvidence("full", EvidenceSourceAutomated, 1)
		fullSuite.FullSuite = true
		candidate.Evidence = []EvidenceSummary{fullSuite}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("full-suite evidence was accepted when prohibited")
		}

		candidate = task.Clone()
		candidate.Evidence = []EvidenceSummary{validEvidence("manual", EvidenceSourceUser, 0)}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("user evidence was accepted when manual handoff was prohibited")
		}
	})

	t.Run("outcome references retained evidence with exact sources", func(t *testing.T) {
		candidate := terminalTask(t, TerminalCompleted)
		candidate.Outcome.AutomatedEvidenceIDs = []ID{"missing"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("outcome reference to missing evidence was accepted")
		}

		permissiveContract, err := NewContract(
			"goal", nil, nil, []string{"criterion"},
			VerificationBudget{
				Level:                VerificationTargeted,
				MaxAutomaticCommands: 2,
				AllowFullSuite:       true,
				AllowManualHandoff:   true,
			},
		)
		if err != nil {
			t.Fatal(err)
		}

		candidate = terminalTask(t, TerminalCompleted)
		candidate.Contract = permissiveContract
		candidate.Evidence = []EvidenceSummary{validEvidence("user", EvidenceSourceUser, 0)}
		candidate.Outcome.AutomatedEvidenceIDs = []ID{"user"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("automated outcome list referenced user evidence")
		}

		candidate = terminalTask(t, TerminalCompleted)
		candidate.Contract = permissiveContract
		candidate.Evidence = []EvidenceSummary{validEvidence("auto", EvidenceSourceAutomated, 1)}
		candidate.Outcome.ManualEvidenceIDs = []ID{"auto"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("manual outcome list referenced automated evidence")
		}

		candidate = terminalTask(t, TerminalCompleted)
		candidate.Contract = permissiveContract
		candidate.Evidence = []EvidenceSummary{
			validEvidence("auto", EvidenceSourceAutomated, 1),
			validEvidence("user", EvidenceSourceUser, 0),
		}
		candidate.Outcome.AutomatedEvidenceIDs = []ID{"auto"}
		candidate.Outcome.ManualEvidenceIDs = []ID{"user"}
		if err := candidate.Validate(); err != nil {
			t.Fatalf("valid retained evidence references rejected: %v", err)
		}
	})

	t.Run("outcome references cannot bypass verification budget", func(t *testing.T) {
		candidate := terminalTask(t, TerminalCompleted)
		fullSuite := validEvidence("full", EvidenceSourceAutomated, 1)
		fullSuite.FullSuite = true
		candidate.Evidence = []EvidenceSummary{fullSuite}
		candidate.Outcome.AutomatedEvidenceIDs = []ID{"full"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("referenced full-suite evidence was accepted when prohibited")
		}

		candidate = terminalTask(t, TerminalCompleted)
		candidate.Evidence = []EvidenceSummary{validEvidence("user", EvidenceSourceUser, 0)}
		candidate.Outcome.ManualEvidenceIDs = []ID{"user"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("referenced user evidence was accepted when manual handoff was prohibited")
		}

		candidate = terminalTask(t, TerminalCompleted)
		candidate.Evidence = []EvidenceSummary{
			validEvidence("auto-1", EvidenceSourceAutomated, 1),
			validEvidence("auto-2", EvidenceSourceAutomated, 1),
			validEvidence("auto-3", EvidenceSourceAutomated, 1),
		}
		candidate.Outcome.AutomatedEvidenceIDs = []ID{"auto-1", "auto-2", "auto-3"}
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("referenced automatic evidence over the command budget was accepted")
		}
	})

	t.Run("last operation must be the current committed revision", func(t *testing.T) {
		candidate := task.Clone()
		candidate.Revision = 2
		candidate.CurrentAction.Revision = 2
		actionID := ID("action-previous")
		candidate.LastOperation = &LastOperation{
			OperationID:   "operation-1",
			Kind:          OperationApplyAction,
			ActionID:      &actionID,
			FromRevision:  1,
			ToRevision:    2,
			PayloadDigest: testDigest("c"),
			CommittedAt:   candidate.UpdatedAt,
		}
		if err := candidate.Validate(); err != nil {
			t.Fatalf("valid last operation rejected: %v", err)
		}
		candidate.LastOperation.ToRevision = 1
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("stale last operation was accepted")
		}
	})

	t.Run("terminal outcome covers immutable acceptance in order", func(t *testing.T) {
		contract, err := NewContract(
			"goal", nil, nil, []string{"first", "second"},
			VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: 2},
		)
		if err != nil {
			t.Fatal(err)
		}
		candidate := terminalTask(t, TerminalCompleted)
		candidate.Contract = contract
		candidate.Outcome = outcomePointer(validOutcome(TerminalCompleted, []string{"second", "first"}))
		completedAt := candidate.Outcome.CompletedAt
		candidate.CompletedAt = &completedAt
		if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
			t.Fatal("out-of-order outcome acceptance was accepted")
		}
	})
}

func TestLastOperationKindAndOptionalActionSemantics(t *testing.T) {
	applyActionID := ID("action-1")
	base := LastOperation{
		OperationID:   "operation-1",
		Kind:          OperationApplyAction,
		ActionID:      &applyActionID,
		FromRevision:  1,
		ToRevision:    2,
		PayloadDigest: testDigest("a"),
		CommittedAt:   testTime,
	}
	if err := base.Validate(); err != nil {
		t.Fatalf("valid apply operation rejected: %v", err)
	}

	open := base
	open.Kind = OperationOpenTask
	open.ActionID = nil
	open.FromRevision = 0
	open.ToRevision = 1
	if err := open.Validate(); err != nil {
		t.Fatalf("valid open operation rejected: %v", err)
	}

	cancel := base
	cancel.Kind = OperationCancelTask
	cancel.ActionID = nil
	if err := cancel.Validate(); err != nil {
		t.Fatalf("valid cancel operation rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*LastOperation)
	}{
		{name: "open with action ID", mutate: func(o *LastOperation) {
			o.Kind = OperationOpenTask
			o.FromRevision = 0
			o.ToRevision = 1
		}},
		{name: "open from positive revision", mutate: func(o *LastOperation) {
			o.Kind = OperationOpenTask
			o.ActionID = nil
		}},
		{name: "apply without action ID", mutate: func(o *LastOperation) { o.ActionID = nil }},
		{name: "apply from zero revision", mutate: func(o *LastOperation) {
			o.FromRevision = 0
			o.ToRevision = 1
		}},
		{name: "cancel with action ID", mutate: func(o *LastOperation) { o.Kind = OperationCancelTask }},
		{name: "unknown kind", mutate: func(o *LastOperation) { o.Kind = "resume_task" }},
		{name: "empty optional action ID", mutate: func(o *LastOperation) {
			empty := ID("")
			o.ActionID = &empty
		}},
		{name: "nonconsecutive revision", mutate: func(o *LastOperation) { o.ToRevision++ }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := base
			actionID := *base.ActionID
			candidate.ActionID = &actionID
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid operation was accepted: %#v", candidate)
			}
		})
	}
}

func TestTaskAggregateLimitUsesEscapedJSONBytes(t *testing.T) {
	low, high := 1, MaxEvidenceSummaryBytes
	var maximum Task
	maximumLength := 0
	for low <= high {
		mid := low + (high-low)/2
		candidate := taskWithEscapedEvidence(t, mid)
		if candidate.Validate() == nil {
			maximum = candidate
			maximumLength = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	if maximumLength == 0 {
		t.Fatal("no valid Task aggregate boundary found")
	}
	size, err := taskAggregateSize(maximum)
	if err != nil || size > MaxTaskAggregateBytes {
		t.Fatalf("maximum valid Task size = %d, err = %v", size, err)
	}
	if size+MaxResultEnvelopeOverheadBytes >= MaxResultEnvelopeBytes {
		t.Fatalf("maximum valid Task plus envelope overhead = %d, limit = %d",
			size+MaxResultEnvelopeOverheadBytes, MaxResultEnvelopeBytes)
	}
	if maximumLength < MaxEvidenceSummaryBytes {
		overLimit := taskWithEscapedEvidence(t, maximumLength+1)
		if !errors.Is(overLimit.Validate(), ErrInvalidArgument) {
			t.Fatal("Task above encoded aggregate limit was accepted")
		}
	}
}

func TestTaskCloneHasNoMutableAliases(t *testing.T) {
	task := validTask(t)
	resume := PhasePlan
	task.ResumePhase = &resume
	task.Phase = PhaseBlocked
	task.CurrentAction.Kind = ActionResolveBlocker
	task.CurrentAction.PayloadContract = PhaseBlocked
	task.Blocker = &Blocker{
		BlockerID:             "blocker-1",
		Code:                  ErrorTaskBlocked,
		Cause:                 RecoveryConflicting,
		Message:               "blocked",
		ResumePhase:           resume,
		ObservedBindingDigest: task.Repository.BindingDigest,
		Condition: BlockerCondition{
			Kind:                  BlockerConditionRestoreIssuanceBinding,
			ExpectedBindingDigest: task.Repository.BindingDigest,
		},
		RequiredResolution: "resolve it",
		CreatedAt:          testTime,
	}
	task.Evidence = []EvidenceSummary{validEvidence("evidence", EvidenceSourceStatic, 0)}
	operationActionID := ID("action-previous")
	task.Revision = 2
	task.CurrentAction.Revision = 2
	task.LastOperation = &LastOperation{
		OperationID:   "operation-1",
		Kind:          OperationApplyAction,
		ActionID:      &operationActionID,
		FromRevision:  1,
		ToRevision:    2,
		PayloadDigest: testDigest("f"),
		CommittedAt:   task.UpdatedAt,
	}

	clone := task.Clone()
	*clone.Repository.Branch = "changed"
	clone.CurrentAction.AllowedEffects[0] = EffectEditRepositoryFiles
	clone.Blocker.Message = "changed"
	clone.Evidence[0].Summary = "changed"
	*clone.LastOperation.ActionID = "changed-action"
	*clone.ResumePhase = PhaseAssess
	if *task.Repository.Branch != "main" || task.CurrentAction.AllowedEffects[0] != EffectReadRepository ||
		task.Blocker.Message != "blocked" || task.Evidence[0].Summary != "summary" ||
		*task.LastOperation.ActionID != "action-previous" ||
		*task.ResumePhase != PhasePlan {
		t.Fatal("task clone retained mutable aliases")
	}
}

func TestStableTypedErrors(t *testing.T) {
	codes := []ErrorCode{
		ErrorInvalidArgument, ErrorNotGitRepository, ErrorTaskNotFound, ErrorActiveTaskConflict,
		ErrorHostOwnershipConflict, ErrorRevisionConflict, ErrorActionStale, ErrorRepositoryDrift,
		ErrorVerificationBudgetExceeded, ErrorTaskBlocked, ErrorTaskTerminal, ErrorSchemaUnsupported,
		ErrorStorageUnavailable, ErrorInternal,
	}
	for _, code := range codes {
		if !code.IsValid() {
			t.Fatalf("stable error code %q is invalid", code)
		}
	}
	if ErrorCode("REPOSITORY_UNBORN_UNSUPPORTED").IsValid() || ErrorCode("invalid_argument").IsValid() {
		t.Fatal("undocumented error-code alias was accepted")
	}

	err := NewError(ErrorInvalidArgument, "  invalid value  ")
	if err.Code != ErrorInvalidArgument || err.Message != "invalid value" {
		t.Fatalf("NewError = %#v, want normalized typed error", err)
	}
	if !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("errors.Is(%v, ErrInvalidArgument) = false", err)
	}
	var typed *Error
	if !errors.As(err, &typed) || typed.Code != ErrorInvalidArgument {
		t.Fatalf("errors.As failed for typed domain error: %#v", typed)
	}

	unknown := NewError("UNKNOWN", "failure")
	if unknown.Code != ErrorInternal {
		t.Fatalf("unknown error code mapped to %q, want %q", unknown.Code, ErrorInternal)
	}
	oversized := NewError(ErrorInternal, strings.Repeat("x", MaxErrorMessageBytes+1))
	if oversized.Message != "domain operation failed" || len(oversized.Message) > MaxErrorMessageBytes {
		t.Fatalf("oversized error message was not bounded: %#v", oversized)
	}
}

func validContractForTest(t *testing.T) Contract {
	t.Helper()
	contract, err := NewContract(
		"goal",
		[]string{"scope"},
		[]string{"excluded"},
		[]string{"criterion"},
		VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: 2},
	)
	if err != nil {
		t.Fatalf("construct valid contract: %v", err)
	}
	return contract
}

func validRepositoryBinding() RepositoryBinding {
	branch := "main"
	head := strings.Repeat("a", 40)
	return RepositoryBinding{
		CanonicalRoot:       filepath.Join(string(filepath.Separator), "tmp", "repository"),
		GitCommonDirDigest:  testDigest("a"),
		RepositoryIdentity:  testDigest("b"),
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: testDigest("c"),
		ObservedAt:          testTime,
		BindingDigest:       testDigest("d"),
	}
}

func validAction() Action {
	return Action{
		ActionID:                "action-1",
		Kind:                    ActionAssessTask,
		TaskID:                  "task-1",
		Revision:                1,
		RepositoryBindingDigest: testDigest("d"),
		AllowedEffects:          []AllowedEffect{EffectReadRepository},
		RequiredEvidence: []EvidenceRequirement{
			{Kind: RequirementRepositoryObservation, Required: true},
		},
		PayloadContract: PhaseIntake,
		Guidance:        "assess the task",
		IssuedAt:        testTime,
	}
}

func validEvidence(id ID, source EvidenceSource, commands int) EvidenceSummary {
	status := EvidencePassed
	if source == EvidenceSourceHostObserved {
		status = EvidenceObserved
	}
	return EvidenceSummary{
		EvidenceID:   id,
		Source:       source,
		Name:         "check",
		Status:       status,
		Summary:      "summary",
		Digest:       testDigest("e"),
		CommandCount: commands,
		RecordedAt:   testTime,
	}
}

func validOutcome(status TerminalStatus, criteria []string) Outcome {
	acceptance := make([]OutcomeCriterion, len(criteria))
	for i, criterion := range criteria {
		criterionStatus := CriterionSatisfied
		if status == TerminalCancelled {
			criterionStatus = CriterionUnverified
		}
		acceptance[i] = OutcomeCriterion{Criterion: criterion, Status: criterionStatus}
	}
	return Outcome{
		Status:                       status,
		Acceptance:                   acceptance,
		UnverifiedItems:              []string{"none"},
		Risks:                        []string{"risk"},
		FinalRepositoryBindingDigest: testDigest("d"),
		Summary:                      "delivery summary",
		CompletedAt:                  testTime.Add(time.Minute),
	}
}

func validTask(t *testing.T) Task {
	t.Helper()
	repository := validRepositoryBinding()
	action := validAction()
	return Task{
		TaskID:        "task-1",
		OriginHost:    HostCodex,
		Contract:      validContractForTest(t),
		Repository:    repository,
		Phase:         PhaseIntake,
		CurrentAction: &action,
		Revision:      1,
		CreatedAt:     testTime,
		UpdatedAt:     testTime,
	}
}

func terminalTask(t *testing.T, status TerminalStatus) Task {
	t.Helper()
	task := validTask(t)
	outcome := validOutcome(status, task.Contract.AcceptanceCriteria())
	task.CurrentAction = nil
	task.Outcome = &outcome
	task.CompletedAt = cloneTimePointer(&outcome.CompletedAt)
	task.UpdatedAt = outcome.CompletedAt
	if status == TerminalCompleted {
		task.Phase = PhaseDone
	} else {
		task.Phase = PhaseCancelled
	}
	return task
}

func outcomePointer(outcome Outcome) *Outcome { return &outcome }

func testDigest(character string) Digest {
	return Digest(strings.Repeat(character, sha256.Size*2))
}

func uniqueStrings(prefix string, count int) []string {
	values := make([]string, count)
	for i := range values {
		values[i] = fmt.Sprintf("%s-%d", prefix, i)
	}
	return values
}

func escapedUniqueStrings(count, itemBytes int) []string {
	values := make([]string, count)
	for i := range values {
		suffix := fmt.Sprintf("-%d", i)
		values[i] = strings.Repeat("\\", itemBytes-len(suffix)) + suffix
	}
	return values
}

func taskWithEscapedEvidence(t *testing.T, summaryBytes int) Task {
	t.Helper()
	task := validTask(t)
	task.Evidence = make([]EvidenceSummary, MaxRetainedEvidenceItems)
	for i := range task.Evidence {
		evidence := validEvidence(ID(fmt.Sprintf("evidence-%d", i)), EvidenceSourceStatic, 0)
		evidence.Summary = strings.Repeat("\\", summaryBytes)
		task.Evidence[i] = evidence
	}
	return task
}
