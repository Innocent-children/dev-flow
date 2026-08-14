package domain

import "time"

type Blocker struct {
	BlockerID             ID        `json:"blocker_id"`
	Code                  ErrorCode `json:"code"`
	Message               string    `json:"message"`
	ResumePhase           Phase     `json:"resume_phase"`
	ObservedBindingDigest Digest    `json:"observed_binding_digest"`
	RequiredResolution    string    `json:"required_resolution"`
	CreatedAt             time.Time `json:"created_at"`
}

func (b Blocker) Validate() error {
	if validateID(b.BlockerID) != nil || !b.Code.IsValid() || !b.ResumePhase.NormalNonTerminal() ||
		requireNormalizedText(b.Message, MaxBlockerMessageBytes, true) != nil ||
		validateDigest(b.ObservedBindingDigest) != nil ||
		requireNormalizedText(b.RequiredResolution, MaxResolutionTextBytes, true) != nil ||
		validateUTC(b.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}
