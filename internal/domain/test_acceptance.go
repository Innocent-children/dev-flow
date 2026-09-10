package domain

// KnownFailureAcceptance retains the developer's decision about an exact set of
// failed checks and the comparison made against the starting repository content.
type KnownFailureAcceptance struct {
	Source           EvidenceSource `json:"source"`
	Summary          string         `json:"summary"`
	FailedChecks     []string       `json:"failed_checks"`
	ComparisonCheck  string         `json:"comparison_check"`
	TaskPlanRevision uint32         `json:"task_plan_revision"`
	ContentDigest    Digest         `json:"content_digest"`
}

func (a KnownFailureAcceptance) Validate() error {
	if a.Source != EvidenceSourceUser || requireNormalizedText(a.Summary, MaxEvidenceSummaryBytes, true) != nil ||
		requireNormalizedText(a.ComparisonCheck, MaxEvidenceNameBytes, true) != nil ||
		len(a.FailedChecks) == 0 || validateNormalizedList(a.FailedChecks) != nil ||
		a.TaskPlanRevision == 0 || !a.ContentDigest.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

// KnownFailuresAccepted validates the complete current check set. The Host owns
// running the comparison and obtaining the decision; Core owns their references
// and the plan/content binding.
func KnownFailuresAccepted(a *KnownFailureAcceptance, checks []EvidenceSummary, revision uint32, content Digest) bool {
	if a == nil || a.Validate() != nil || a.TaskPlanRevision != revision || a.ContentDigest != content {
		return false
	}
	remaining := make(map[string]bool, len(a.FailedChecks))
	for _, name := range a.FailedChecks {
		remaining[name] = true
	}
	comparison := false
	seen := make(map[string]bool, len(checks))
	for _, check := range checks {
		if seen[check.Name] {
			return false
		}
		seen[check.Name] = true
		switch check.Status {
		case EvidenceFailed:
			if check.Source != EvidenceSourceAutomated || !remaining[check.Name] {
				return false
			}
			delete(remaining, check.Name)
		case EvidencePassed:
			if check.Name == a.ComparisonCheck && check.Source == EvidenceSourceAutomated {
				comparison = true
			}
		default:
			return false
		}
	}
	return comparison && len(remaining) == 0
}

// TestEvidenceEligible recognizes retained results of a completed Test. Failed
// checks remain available for inspection; only passed checks prove acceptance criteria.
func TestEvidenceEligible(record *TestRecord, item EvidenceSummary) bool {
	if item.Status == EvidencePassed {
		return true
	}
	if record == nil || record.KnownFailureAcceptance == nil || item.Status != EvidenceFailed {
		return false
	}
	for _, name := range record.KnownFailureAcceptance.FailedChecks {
		if name == item.Name {
			return true
		}
	}
	return false
}
