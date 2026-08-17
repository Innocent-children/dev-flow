package recovery

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestClassifyRecoveryDecisionTable(t *testing.T) {
	tests := []struct {
		name           string
		mutate         func(*ClassificationFacts)
		classification domain.RecoveryClassification
		lastOperation  LastOperationRelation
		evidence       OperationEvidenceState
		retrySafe      bool
		advice         RecoveryAdvice
		directive      MutationDirective
		proof          bool
		condition      bool
	}{
		{
			name: "priority 1 exact latest operation proof wins after source advanced",
			mutate: func(facts *ClassificationFacts) {
				facts.TaskRevision = 4
				facts.CurrentTaskPhase = domain.PhaseImplement
				nextActionID := domain.ID("action-next")
				facts.CurrentActionID = &nextActionID
				facts.SourceCurrent = false
				facts.LastOperationRelation = LastOperationExact
				facts.OperationEvidence = OperationEvidenceComplete
				facts.CommittedProof = recoveryProof(*facts)
			},
			classification: domain.RecoveryCompletedAndRecorded,
			lastOperation:  LastOperationExact,
			evidence:       OperationEvidenceComplete,
			retrySafe:      false,
			advice:         AdviceReadNextAction,
			directive:      DirectiveNoWrite,
			proof:          true,
		},
		{
			name: "priority 2 partially matching latest operation is contradictory",
			mutate: func(facts *ClassificationFacts) {
				facts.LastOperationRelation = LastOperationContradictory
			},
			classification: domain.RecoveryConflicting,
			lastOperation:  LastOperationContradictory,
			evidence:       OperationEvidenceNone,
			retrySafe:      false,
			advice:         AdviceSubmitRecoveryApply,
			directive:      DirectiveCreateBlocker,
			condition:      true,
		},
		{
			name: "priority 3 superseded source does not consult older events",
			mutate: func(facts *ClassificationFacts) {
				facts.TaskRevision = 4
				facts.CurrentTaskPhase = domain.PhaseImplement
				nextActionID := domain.ID("action-next")
				facts.CurrentActionID = &nextActionID
				facts.SourceCurrent = false
				facts.OperationEvidence = OperationEvidenceComplete
			},
			classification: domain.RecoveryConflicting,
			lastOperation:  LastOperationUnrelated,
			evidence:       OperationEvidenceComplete,
			retrySafe:      false,
			advice:         AdviceReadNextAction,
			directive:      DirectiveRevisionConflict,
		},
		{
			name: "priority 4 action-forbidden worktree change conflicts",
			mutate: func(facts *ClassificationFacts) {
				facts.Operation.SourcePhase = domain.PhaseIntake
				facts.Operation.ActionKind = domain.ActionAssessTask
				facts.CurrentTaskPhase = domain.PhaseIntake
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
				facts.CurrentActionAcceptsObserved = false
			},
			classification: domain.RecoveryConflicting,
			lastOperation:  LastOperationUnrelated,
			evidence:       OperationEvidenceNone,
			retrySafe:      false,
			advice:         AdviceSubmitRecoveryApply,
			directive:      DirectiveCreateBlocker,
			condition:      true,
		},
		{
			name: "priority 5 implementation effect without payload is partial",
			mutate: func(facts *ClassificationFacts) {
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
			},
			classification: domain.RecoveryPartiallyCompleted,
			lastOperation:  LastOperationUnrelated,
			evidence:       OperationEvidenceNone,
			retrySafe:      false,
			advice:         AdviceSubmitRecoveryApply,
			directive:      DirectiveCreateBlocker,
			condition:      true,
		},
		{
			name: "priority 6 complete matching payload is completed but unrecorded",
			mutate: func(facts *ClassificationFacts) {
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
				facts.OperationEvidence = OperationEvidenceComplete
			},
			classification: domain.RecoveryCompletedButUnrecorded,
			lastOperation:  LastOperationUnrelated,
			evidence:       OperationEvidenceComplete,
			retrySafe:      false,
			advice:         AdviceSubmitRecoveryApply,
			directive:      DirectiveNormalTransition,
		},
		{
			name:           "priority 7 current exact source with null payload is not started",
			mutate:         func(*ClassificationFacts) {},
			classification: domain.RecoveryNotStarted,
			lastOperation:  LastOperationUnrelated,
			evidence:       OperationEvidenceNone,
			retrySafe:      true,
			advice:         AdviceRetryCurrentAction,
			directive:      DirectiveNoWrite,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			facts := validClassificationFacts()
			tt.mutate(&facts)

			decision, err := Classify(facts)
			if err != nil {
				t.Fatalf("Classify() error = %v", err)
			}
			if decision.Assessment.Classification != tt.classification ||
				decision.Assessment.LastOperationRelation != tt.lastOperation ||
				decision.Assessment.OperationEvidence != tt.evidence ||
				decision.Assessment.ActionRetrySafe != tt.retrySafe ||
				decision.Assessment.NextAdvice != tt.advice || decision.Directive != tt.directive {
				t.Fatalf("Classify() = %#v", decision)
			}
			if decision.Assessment.Operation != facts.Operation ||
				decision.Assessment.TaskRevision != facts.TaskRevision ||
				decision.Assessment.IssuanceBindingDigest != facts.IssuanceBindingDigest ||
				decision.Assessment.AuthoritativeBindingDigest != facts.AuthoritativeBindingDigest ||
				decision.Assessment.ObservedBindingDigest != facts.ObservedBindingDigest ||
				decision.Assessment.RepositoryRelation != facts.RepositoryRelation ||
				decision.Assessment.OperationPayloadDigest != facts.OperationPayloadDigest {
				t.Fatalf("classification changed Core-derived identity facts: decision=%#v facts=%#v", decision, facts)
			}
			if (decision.Assessment.CommittedProof != nil) != tt.proof {
				t.Fatalf("CommittedProof presence = %t, want %t", decision.Assessment.CommittedProof != nil, tt.proof)
			}
			if tt.proof && !reflect.DeepEqual(decision.Assessment.CommittedProof, facts.CommittedProof) {
				t.Fatalf("CommittedProof = %#v, want exact %#v", decision.Assessment.CommittedProof, facts.CommittedProof)
			}
			if (decision.Assessment.UnblockCondition != nil) != tt.condition {
				t.Fatalf("UnblockCondition presence = %t, want %t", decision.Assessment.UnblockCondition != nil, tt.condition)
			}
			if err := decision.Assessment.Validate(); err != nil {
				t.Fatalf("RecoveryAssessment.Validate() error = %v", err)
			}

			repeated, err := Classify(facts)
			if err != nil {
				t.Fatalf("repeated Classify() error = %v", err)
			}
			if !reflect.DeepEqual(decision, repeated) {
				t.Fatalf("pure classifier changed result:\nfirst  = %#v\nsecond = %#v", decision, repeated)
			}
		})
	}

	t.Run("exact proof has priority over otherwise contradictory repository evidence", func(t *testing.T) {
		facts := validClassificationFacts()
		facts.TaskRevision = 4
		facts.SourceCurrent = false
		facts.RepositoryRelation = RepositoryForbiddenChange
		facts.ObservedBindingDigest = recoveryDigest("3")
		facts.OperationEvidence = OperationEvidenceContradictory
		facts.LastOperationRelation = LastOperationExact
		facts.CommittedProof = recoveryProof(facts)
		decision, err := Classify(facts)
		if err != nil {
			t.Fatal(err)
		}
		if decision.Assessment.Classification != domain.RecoveryCompletedAndRecorded {
			t.Fatalf("classification = %q", decision.Assessment.Classification)
		}
	})
}

func TestClassifySupersededSourcesAndInsufficientEvidenceRemainConservative(t *testing.T) {
	tests := []struct {
		name           string
		mutate         func(*ClassificationFacts)
		classification domain.RecoveryClassification
		directive      MutationDirective
		advice         RecoveryAdvice
	}{
		{
			name: "stale expected revision",
			mutate: func(facts *ClassificationFacts) {
				facts.TaskRevision++
				facts.SourceCurrent = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveRevisionConflict,
			advice:         AdviceReadNextAction,
		},
		{
			name: "current action changed",
			mutate: func(facts *ClassificationFacts) {
				actionID := domain.ID("action-current")
				facts.CurrentActionID = &actionID
				facts.SourceCurrent = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveActionStale,
			advice:         AdviceReadNextAction,
		},
		{
			name: "source phase changed",
			mutate: func(facts *ClassificationFacts) {
				facts.CurrentTaskPhase = domain.PhaseImplement
				facts.SourceCurrent = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveActionStale,
			advice:         AdviceReadNextAction,
		},
		{
			name: "issuance binding superseded",
			mutate: func(facts *ClassificationFacts) {
				facts.AuthoritativeBindingDigest = recoveryDigest("3")
				facts.ObservedBindingDigest = recoveryDigest("3")
				facts.SourceCurrent = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveActionStale,
			advice:         AdviceReadNextAction,
		},
		{
			name: "blocked task retains existing blocker",
			mutate: func(facts *ClassificationFacts) {
				facts.CurrentTaskPhase = domain.PhaseBlocked
				actionID := domain.ID("action-resolve-blocker")
				facts.CurrentActionID = &actionID
				condition := *facts.ProposedUnblockCondition
				facts.ExistingUnblockCondition = &condition
				facts.SourceCurrent = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveReturnExistingBlocker,
			advice:         AdviceResolveBlocker,
		},
		{
			name: "related committed record contradiction outranks complete evidence",
			mutate: func(facts *ClassificationFacts) {
				facts.LastOperationRelation = LastOperationContradictory
				facts.OperationEvidence = OperationEvidenceComplete
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveCreateBlocker,
			advice:         AdviceSubmitRecoveryApply,
		},
		{
			name: "contradictory evidence outranks worktree completion",
			mutate: func(facts *ClassificationFacts) {
				facts.OperationEvidence = OperationEvidenceContradictory
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveCreateBlocker,
			advice:         AdviceSubmitRecoveryApply,
		},
		{
			name: "forbidden repository relation outranks complete payload",
			mutate: func(facts *ClassificationFacts) {
				facts.OperationEvidence = OperationEvidenceComplete
				facts.RepositoryRelation = RepositoryForbiddenChange
				facts.ObservedBindingDigest = recoveryDigest("3")
				facts.CurrentActionAcceptsObserved = false
			},
			classification: domain.RecoveryConflicting,
			directive:      DirectiveCreateBlocker,
			advice:         AdviceSubmitRecoveryApply,
		},
		{
			name: "worktree change without retained evidence stays partial",
			mutate: func(facts *ClassificationFacts) {
				facts.RepositoryRelation = RepositoryWorktreeOnlyChanged
				facts.ObservedBindingDigest = recoveryDigest("3")
			},
			classification: domain.RecoveryPartiallyCompleted,
			directive:      DirectiveCreateBlocker,
			advice:         AdviceSubmitRecoveryApply,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			facts := validClassificationFacts()
			tt.mutate(&facts)
			decision, err := Classify(facts)
			if err != nil {
				t.Fatalf("Classify() error = %v", err)
			}
			if decision.Assessment.Classification != tt.classification ||
				decision.Directive != tt.directive || decision.Assessment.NextAdvice != tt.advice ||
				decision.Assessment.ActionRetrySafe || decision.Assessment.CommittedProof != nil {
				t.Fatalf("conservative decision = %#v", decision)
			}
		})
	}
}

func TestClassifyRecoveryRejectsInvalidFacts(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ClassificationFacts)
	}{
		{name: "invalid operation identity", mutate: func(facts *ClassificationFacts) { facts.Operation.OperationID = " invalid " }},
		{name: "invalid source phase", mutate: func(facts *ClassificationFacts) { facts.Operation.SourcePhase = domain.PhaseDone }},
		{name: "invalid task revision", mutate: func(facts *ClassificationFacts) { facts.TaskRevision = 0 }},
		{name: "invalid current action identity", mutate: func(facts *ClassificationFacts) { invalid := domain.ID(" bad"); facts.CurrentActionID = &invalid }},
		{name: "invalid issuance digest", mutate: func(facts *ClassificationFacts) { facts.IssuanceBindingDigest = "digest" }},
		{name: "invalid repository relation", mutate: func(facts *ClassificationFacts) { facts.RepositoryRelation = "similar" }},
		{name: "invalid LastOperation relation", mutate: func(facts *ClassificationFacts) { facts.LastOperationRelation = "missing" }},
		{name: "invalid evidence state", mutate: func(facts *ClassificationFacts) { facts.OperationEvidence = "partial" }},
		{name: "invalid payload digest", mutate: func(facts *ClassificationFacts) { facts.OperationPayloadDigest = "digest" }},
		{name: "non UTC observation", mutate: func(facts *ClassificationFacts) {
			facts.ObservedAt = facts.ObservedAt.In(time.FixedZone("local", 3600))
		}},
		{name: "source-current revision contradiction", mutate: func(facts *ClassificationFacts) { facts.TaskRevision++ }},
		{name: "exact latest operation without proof", mutate: func(facts *ClassificationFacts) { facts.LastOperationRelation = LastOperationExact }},
		{name: "proof on unrelated operation", mutate: func(facts *ClassificationFacts) { facts.CommittedProof = recoveryProof(*facts) }},
		{name: "proof payload mismatch", mutate: func(facts *ClassificationFacts) {
			facts.LastOperationRelation = LastOperationExact
			facts.CommittedProof = recoveryProof(*facts)
			facts.CommittedProof.PayloadDigest = recoveryDigest("9")
		}},
		{name: "invalid proposed condition", mutate: func(facts *ClassificationFacts) {
			facts.ProposedUnblockCondition.ExpectedBindingDigest = recoveryDigest("7")
		}},
		{name: "blocked task missing stored condition", mutate: func(facts *ClassificationFacts) {
			facts.CurrentTaskPhase = domain.PhaseBlocked
			facts.ExistingUnblockCondition = nil
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			facts := validClassificationFacts()
			tt.mutate(&facts)
			if decision, err := Classify(facts); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("Classify() = %#v, error = %v, want INVALID_ARGUMENT", decision, err)
			}
		})
	}

	t.Run("partial identity match cannot fall through to not started", func(t *testing.T) {
		facts := validClassificationFacts()
		facts.LastOperationRelation = LastOperationContradictory
		decision, err := Classify(facts)
		if err != nil {
			t.Fatal(err)
		}
		if decision.Assessment.Classification != domain.RecoveryConflicting || decision.Assessment.ActionRetrySafe {
			t.Fatalf("decision = %#v", decision)
		}
	})

	t.Run("assessment rejects caller-shaped proof and retry contradictions", func(t *testing.T) {
		facts := validClassificationFacts()
		decision, err := Classify(facts)
		if err != nil {
			t.Fatal(err)
		}
		assessment := decision.Assessment
		assessment.ActionRetrySafe = false
		if !errors.Is(assessment.Validate(), domain.ErrInvalidArgument) {
			t.Fatalf("not-started assessment accepted retry_safe=false: %#v", assessment)
		}

		assessment = decision.Assessment
		assessment.CommittedProof = recoveryProof(facts)
		if !errors.Is(assessment.Validate(), domain.ErrInvalidArgument) {
			t.Fatalf("not-started assessment accepted committed proof: %#v", assessment)
		}
	})

	t.Run("transient assessment has no unbounded or sensitive projection fields", func(t *testing.T) {
		assessmentType := reflect.TypeOf(RecoveryAssessment{})
		for _, forbidden := range []string{
			"CanonicalRoot", "DatabasePath", "GitCommonDirectory", "Source", "Diff", "RawStatus",
			"FileBytes", "Environment", "Command", "Output", "Details", "Message",
		} {
			if _, exists := assessmentType.FieldByName(forbidden); exists {
				t.Fatalf("RecoveryAssessment exposes forbidden field %s", forbidden)
			}
		}
		if assessmentType.NumField() != 16 {
			t.Fatalf("RecoveryAssessment has %d fields, want exact closed 16", assessmentType.NumField())
		}
	})
}

func validClassificationFacts() ClassificationFacts {
	currentActionID := domain.ID("action-original")
	condition := domain.BlockerCondition{
		Kind:                  domain.BlockerConditionRestoreIssuanceBinding,
		ExpectedBindingDigest: recoveryDigest("1"),
	}
	return ClassificationFacts{
		Operation: OperationReference{
			OperationID:      "request-original",
			SourcePhase:      domain.PhasePlan,
			ExpectedRevision: 3,
			ActionID:         currentActionID,
			ActionKind:       domain.ActionImplementChange,
		},
		TaskRevision:                 3,
		CurrentTaskPhase:             domain.PhasePlan,
		CurrentActionID:              &currentActionID,
		IssuanceBindingDigest:        recoveryDigest("1"),
		AuthoritativeBindingDigest:   recoveryDigest("1"),
		ObservedBindingDigest:        recoveryDigest("1"),
		RepositoryRelation:           RepositoryExact,
		LastOperationRelation:        LastOperationUnrelated,
		OperationEvidence:            OperationEvidenceNone,
		OperationPayloadDigest:       recoveryDigest("2"),
		SourceCurrent:                true,
		CurrentActionAcceptsObserved: true,
		ProposedUnblockCondition:     &condition,
		ExistingUnblockCondition:     nil,
		ObservedAt:                   time.Date(2026, time.August, 15, 9, 0, 0, 0, time.UTC),
	}
}

func recoveryProof(facts ClassificationFacts) *CommittedOperationProof {
	return &CommittedOperationProof{
		OperationID:   facts.Operation.OperationID,
		Kind:          domain.OperationApplyAction,
		ActionID:      facts.Operation.ActionID,
		FromRevision:  facts.Operation.ExpectedRevision,
		ToRevision:    facts.Operation.ExpectedRevision + 1,
		PayloadDigest: facts.OperationPayloadDigest,
		CommittedAt:   time.Date(2026, time.August, 15, 8, 59, 0, 0, time.UTC),
	}
}

func recoveryDigest(character string) domain.Digest {
	return domain.Digest(strings.Repeat(character, 64))
}
