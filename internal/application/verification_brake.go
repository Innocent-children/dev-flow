package application

import (
	"fmt"
	"sort"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type verificationCheckFingerprint struct {
	Source  domain.EvidenceSource `json:"source"`
	Name    string                `json:"name"`
	Status  domain.EvidenceStatus `json:"status"`
	Summary string                `json:"summary"`
}

type verificationResultFingerprint struct {
	ProblemClass       workflow.ProblemClass          `json:"problem_class"`
	Checks             []verificationCheckFingerprint `json:"checks"`
	FailedItems        []string                       `json:"failed_items"`
	UnverifiedItems    []string                       `json:"unverified_items"`
	ManualHandoffItems []string                       `json:"manual_handoff_items"`
	Findings           []string                       `json:"findings"`
}

type verificationFailureFingerprint struct {
	ProblemClass workflow.ProblemClass          `json:"problem_class"`
	Checks       []verificationCheckFingerprint `json:"checks"`
	FailedItems  []string                       `json:"failed_items"`
	Findings     []string                       `json:"findings"`
}

func recordVerificationAttempt(task *domain.ProcessTask, transition domain.TransitionDefinition, result *workflow.TestResult, evidence []domain.EvidenceSummary, now time.Time) error {
	if task.TaskPlan == nil || task.Implementation == nil {
		return domain.ErrInvalidArgument
	}
	checks := verificationCheckFingerprints(result.Checks, false)
	resultDigest, err := digestCanonical(verificationResultFingerprint{
		ProblemClass:       result.ProblemClass,
		Checks:             checks,
		FailedItems:        sortedText(result.FailedItems),
		UnverifiedItems:    sortedText(result.UnverifiedItems),
		ManualHandoffItems: sortedText(result.ManualHandoffItems),
		Findings:           sortedText(result.Findings),
	})
	if err != nil {
		return domain.ErrInternal
	}
	failed := testFailureFactsPresent(result)
	var failureDigest domain.Digest
	if failed {
		failureDigest, err = digestCanonical(verificationFailureFingerprint{
			ProblemClass: result.ProblemClass,
			Checks:       verificationCheckFingerprints(result.Checks, true),
			FailedItems:  sortedText(result.FailedItems),
			Findings:     sortedText(result.Findings),
		})
		if err != nil {
			return domain.ErrInternal
		}
	}
	evidenceIDs := make([]domain.ID, len(evidence))
	for index := range evidence {
		evidenceIDs[index] = evidence[index].EvidenceID
	}
	paths := append([]string(nil), task.Implementation.ActionChangedPaths...)
	sort.Strings(paths)
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		return domain.ErrInternal
	}
	attempt := domain.VerificationAttempt{
		TaskRevision:           task.Revision + 1,
		TaskPlanRevision:       task.TaskPlan.Revision,
		ImplementationRevision: task.Implementation.Revision,
		ContentDigest:          workspace.Content,
		DestinationNode:        transition.Destination,
		EvidenceIDs:            evidenceIDs,
		ResultDigest:           resultDigest,
		FailureDigest:          failureDigest,
		Failed:                 failed,
		ImplementationPaths:    paths,
		RecordedAt:             now,
	}
	if attempt.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	task.VerificationAttempts = append(task.VerificationAttempts, attempt)
	if len(task.VerificationAttempts) > domain.MaxRetainedVerificationAttempts {
		start := len(task.VerificationAttempts) - domain.MaxRetainedVerificationAttempts
		task.VerificationAttempts = append([]domain.VerificationAttempt(nil), task.VerificationAttempts[start:]...)
	}
	return nil
}

func verificationCheckFingerprints(checks []workflow.EvidenceInput, failedOnly bool) []verificationCheckFingerprint {
	items := make([]verificationCheckFingerprint, 0, len(checks))
	for _, check := range checks {
		if failedOnly && check.Status != domain.EvidenceFailed {
			continue
		}
		items = append(items, verificationCheckFingerprint{Source: check.Source, Name: check.Name, Status: check.Status, Summary: check.Summary})
	}
	sort.Slice(items, func(i, j int) bool {
		left, right := items[i], items[j]
		if left.Name != right.Name {
			return left.Name < right.Name
		}
		if left.Source != right.Source {
			return left.Source < right.Source
		}
		if left.Status != right.Status {
			return left.Status < right.Status
		}
		return left.Summary < right.Summary
	})
	return items
}

func sortedText(values []string) []string {
	result := append([]string(nil), values...)
	sort.Strings(result)
	return result
}

func (s *Service) verificationBrakeBlocker(task domain.ProcessTask, resume domain.NodeID, decision workflow.VerificationBrakeDecision, now time.Time) (*domain.ProcessBlocker, error) {
	blockerID, err := s.id("blocker")
	if err != nil {
		return nil, err
	}
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		return nil, domain.ErrInternal
	}
	message := "Automatic brake paused the Task after three unchanged verification attempts."
	switch decision.Cause {
	case domain.BlockerCauseRepeatedVerificationFailure:
		message = fmt.Sprintf("Automatic brake paused the Task because check %q returned the same failure in three consecutive test attempts.", decision.CheckName)
	case domain.BlockerCauseUnchangedVerificationResult:
		message = "Automatic brake paused the Task because the same verification result was submitted in three consecutive test attempts."
	case domain.BlockerCauseUnchangedTestImplementationLoop:
		message = "Automatic brake paused the Task because three TEST to IMPLEMENT cycles changed the same paths and produced the same failure."
	default:
		return nil, domain.ErrInternal
	}
	return &domain.ProcessBlocker{
		BlockerID:             blockerID,
		Code:                  domain.ErrorTaskBlocked,
		Cause:                 decision.Cause,
		Message:               message,
		ResumeNode:            resume,
		ObservedBindingDigest: workspace.Binding,
		Condition:             domain.BlockerCondition{Kind: domain.BlockerConditionAllowVerificationRetry, ExpectedBindingDigest: workspace.Binding, ExpectedIdentityDigest: workspace.Identity, ExpectedHistoryDigest: workspace.History, ExpectedContentDigest: workspace.Content},
		RequiredResolution:    "Choose a different implementation or design path, explicitly allow one more attempt, or cancel the Task.",
		CreatedAt:             now,
	}, nil
}

func blockerResolvedReason(cause domain.BlockerCause) string {
	if cause.IsVerificationBrake() {
		return "Automatic verification brake resolved after explicit approval for one more attempt."
	}
	return "Recovery blocker resolved after exact repository restoration."
}
