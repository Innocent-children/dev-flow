package workflow

import (
	"sort"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type VerificationBrakeDecision struct {
	Cause     domain.BlockerCause
	CheckName string
}

func (d VerificationBrakeDecision) Triggered() bool {
	return d.Cause.IsVerificationBrake()
}

func EvaluateVerificationBrake(attempts []domain.VerificationAttempt, evidence []domain.EvidenceSummary) (VerificationBrakeDecision, error) {
	if len(attempts) > domain.MaxRetainedVerificationAttempts {
		return VerificationBrakeDecision{}, domain.ErrInvalidArgument
	}
	byID := make(map[domain.ID]domain.EvidenceSummary, len(evidence))
	for _, item := range evidence {
		if item.Validate() != nil {
			return VerificationBrakeDecision{}, domain.ErrInvalidArgument
		}
		if _, duplicate := byID[item.EvidenceID]; duplicate {
			return VerificationBrakeDecision{}, domain.ErrInvalidArgument
		}
		byID[item.EvidenceID] = item
	}
	for _, attempt := range attempts {
		if attempt.Validate() != nil {
			return VerificationBrakeDecision{}, domain.ErrInvalidArgument
		}
		for _, id := range attempt.EvidenceIDs {
			if _, ok := byID[id]; !ok {
				return VerificationBrakeDecision{}, domain.ErrInvalidArgument
			}
		}
	}
	if len(attempts) < domain.MaxRetainedVerificationAttempts {
		return VerificationBrakeDecision{}, nil
	}
	recent := attempts[len(attempts)-domain.MaxRetainedVerificationAttempts:]
	if !sameTaskPlan(recent) || !allHaveAutomaticCheck(recent, byID) {
		return VerificationBrakeDecision{}, nil
	}
	if name := repeatedFailedCheck(recent, byID); name != "" {
		return VerificationBrakeDecision{Cause: domain.BlockerCauseRepeatedVerificationFailure, CheckName: name}, nil
	}
	if unchangedTestImplementationLoop(recent) {
		return VerificationBrakeDecision{Cause: domain.BlockerCauseUnchangedTestImplementationLoop}, nil
	}
	if recent[0].ResultDigest == recent[1].ResultDigest && recent[1].ResultDigest == recent[2].ResultDigest {
		return VerificationBrakeDecision{Cause: domain.BlockerCauseUnchangedVerificationResult}, nil
	}
	return VerificationBrakeDecision{}, nil
}

func sameTaskPlan(attempts []domain.VerificationAttempt) bool {
	return attempts[0].TaskPlanRevision == attempts[1].TaskPlanRevision && attempts[1].TaskPlanRevision == attempts[2].TaskPlanRevision
}

func allHaveAutomaticCheck(attempts []domain.VerificationAttempt, evidence map[domain.ID]domain.EvidenceSummary) bool {
	for _, attempt := range attempts {
		found := false
		for _, id := range attempt.EvidenceIDs {
			if evidence[id].Source == domain.EvidenceSourceAutomated {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func repeatedFailedCheck(attempts []domain.VerificationAttempt, evidence map[domain.ID]domain.EvidenceSummary) string {
	if !attempts[0].Failed || attempts[0].FailureDigest != attempts[1].FailureDigest || attempts[1].FailureDigest != attempts[2].FailureDigest {
		return ""
	}
	candidates := make([]domain.EvidenceSummary, 0)
	for _, id := range attempts[0].EvidenceIDs {
		item := evidence[id]
		if item.Source == domain.EvidenceSourceAutomated && item.Status == domain.EvidenceFailed {
			candidates = append(candidates, item)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Name != candidates[j].Name {
			return candidates[i].Name < candidates[j].Name
		}
		return candidates[i].Summary < candidates[j].Summary
	})
	for _, candidate := range candidates {
		if attemptContainsSameCheck(attempts[1], candidate, evidence) && attemptContainsSameCheck(attempts[2], candidate, evidence) {
			return candidate.Name
		}
	}
	return ""
}

func attemptContainsSameCheck(attempt domain.VerificationAttempt, expected domain.EvidenceSummary, evidence map[domain.ID]domain.EvidenceSummary) bool {
	for _, id := range attempt.EvidenceIDs {
		item := evidence[id]
		if item.Source == expected.Source && item.Name == expected.Name && item.Status == expected.Status && item.Summary == expected.Summary {
			return true
		}
	}
	return false
}

func unchangedTestImplementationLoop(attempts []domain.VerificationAttempt) bool {
	for _, attempt := range attempts {
		if !attempt.Failed || attempt.DestinationNode != domain.NodeImplement || len(attempt.ChangedPaths) == 0 {
			return false
		}
	}
	if !(attempts[0].ImplementationRevision < attempts[1].ImplementationRevision && attempts[1].ImplementationRevision < attempts[2].ImplementationRevision) ||
		attempts[0].FailureDigest != attempts[1].FailureDigest || attempts[1].FailureDigest != attempts[2].FailureDigest {
		return false
	}
	return samePaths(attempts[0].ChangedPaths, attempts[1].ChangedPaths) && samePaths(attempts[1].ChangedPaths, attempts[2].ChangedPaths)
}

func samePaths(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
