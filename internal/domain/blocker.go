package domain

import "time"

type BlockerConditionKind string

const (
	BlockerConditionRestoreIssuanceBinding BlockerConditionKind = "restore_issuance_binding"
)

func (k BlockerConditionKind) IsValid() bool {
	return k == BlockerConditionRestoreIssuanceBinding
}

type BlockerCondition struct {
	Kind                  BlockerConditionKind `json:"kind"`
	ExpectedBindingDigest Digest               `json:"expected_binding_digest"`
}

func (c BlockerCondition) Validate() error {
	if !c.Kind.IsValid() || validateDigest(c.ExpectedBindingDigest) != nil {
		return ErrInvalidArgument
	}
	return nil
}

type ProcessBlocker struct {
	BlockerID             ID                     `json:"blocker_id"`
	Code                  ErrorCode              `json:"code"`
	Cause                 RecoveryClassification `json:"cause"`
	Message               string                 `json:"message"`
	ResumeNode            NodeID                 `json:"resume_node"`
	ObservedBindingDigest Digest                 `json:"observed_binding_digest"`
	Condition             BlockerCondition       `json:"condition"`
	RequiredResolution    string                 `json:"required_resolution"`
	CreatedAt             time.Time              `json:"created_at"`
}

func (b ProcessBlocker) Validate() error {
	if validateID(b.BlockerID) != nil || b.Code != ErrorTaskBlocked ||
		(b.Cause != RecoveryPartiallyCompleted && b.Cause != RecoveryConflicting) ||
		!b.ResumeNode.Normal() ||
		requireNormalizedText(b.Message, MaxBlockerMessageBytes, true) != nil ||
		validateDigest(b.ObservedBindingDigest) != nil || b.Condition.Validate() != nil ||
		requireNormalizedText(b.RequiredResolution, MaxResolutionTextBytes, true) != nil ||
		validateUTC(b.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}
