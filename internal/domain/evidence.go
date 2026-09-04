package domain

import "time"

type EvidenceSummary struct {
	EvidenceID       ID             `json:"evidence_id"`
	TaskPlanRevision uint32         `json:"task_plan_revision"`
	Source           EvidenceSource `json:"source"`
	Name             string         `json:"name"`
	Status           EvidenceStatus `json:"status"`
	Summary          string         `json:"summary"`
	Digest           Digest         `json:"digest"`
	CommandCount     int            `json:"command_count"`
	FullSuite        bool           `json:"full_suite"`
	FullSuiteReason  string         `json:"full_suite_reason"`
	RecordedAt       time.Time      `json:"recorded_at"`
}

func (e EvidenceSummary) Validate() error {
	if validateID(e.EvidenceID) != nil || e.TaskPlanRevision == 0 || !e.Source.IsValid() || !e.Status.IsValid() ||
		requireNormalizedText(e.Name, MaxEvidenceNameBytes, true) != nil ||
		requireNormalizedText(e.Summary, MaxEvidenceSummaryBytes, true) != nil ||
		validateDigest(e.Digest) != nil || validateUTC(e.RecordedAt) != nil ||
		e.CommandCount < 0 || e.CommandCount > MaxAutomaticVerificationCommands {
		return ErrInvalidArgument
	}
	if e.Source != EvidenceSourceAutomated && (e.CommandCount != 0 || e.FullSuite) {
		return ErrInvalidArgument
	}
	if e.FullSuite {
		if requireNormalizedText(e.FullSuiteReason, MaxEvidenceSummaryBytes, true) != nil {
			return ErrInvalidArgument
		}
	} else if e.FullSuiteReason != "" {
		return ErrInvalidArgument
	}
	return nil
}
