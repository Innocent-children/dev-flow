package domain

import "time"

type EvidenceSummary struct {
	EvidenceID   ID             `json:"evidence_id"`
	Source       EvidenceSource `json:"source"`
	Name         string         `json:"name"`
	Status       EvidenceStatus `json:"status"`
	Summary      string         `json:"summary"`
	Digest       Digest         `json:"digest"`
	CommandCount int            `json:"command_count"`
	FullSuite    bool           `json:"full_suite"`
	RecordedAt   time.Time      `json:"recorded_at"`
}

func (e EvidenceSummary) Validate() error {
	if validateID(e.EvidenceID) != nil || !e.Source.IsValid() || !e.Status.IsValid() ||
		requireNormalizedText(e.Name, MaxEvidenceNameBytes, true) != nil ||
		requireNormalizedText(e.Summary, MaxEvidenceSummaryBytes, true) != nil ||
		validateDigest(e.Digest) != nil || validateUTC(e.RecordedAt) != nil ||
		e.CommandCount < 0 || e.CommandCount > MaxAutomaticVerificationCommands {
		return ErrInvalidArgument
	}
	if e.Source != EvidenceSourceAutomated && (e.CommandCount != 0 || e.FullSuite) {
		return ErrInvalidArgument
	}
	return nil
}
