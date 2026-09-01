package domain

import "time"

type BlockerConditionKind string

const (
	BlockerConditionRestoreIssuanceBinding BlockerConditionKind = "restore_issuance_binding"
	BlockerConditionAllowVerificationRetry BlockerConditionKind = "allow_verification_retry"
	BlockerConditionResolveFileScope       BlockerConditionKind = "resolve_file_scope"
)

func (k BlockerConditionKind) IsValid() bool {
	return k == BlockerConditionRestoreIssuanceBinding || k == BlockerConditionAllowVerificationRetry || k == BlockerConditionResolveFileScope
}

type BlockerCause string

const (
	BlockerCauseRecoveryPartiallyCompleted      BlockerCause = BlockerCause(RecoveryPartiallyCompleted)
	BlockerCauseRecoveryConflicting             BlockerCause = BlockerCause(RecoveryConflicting)
	BlockerCauseRepeatedVerificationFailure     BlockerCause = "repeated_verification_failure"
	BlockerCauseUnchangedVerificationResult     BlockerCause = "unchanged_verification_result"
	BlockerCauseUnchangedTestImplementationLoop BlockerCause = "unchanged_test_implementation_loop"
	BlockerCauseFileScopeDecision               BlockerCause = "file_scope_decision"
)

func (c BlockerCause) IsVerificationBrake() bool {
	return c == BlockerCauseRepeatedVerificationFailure ||
		c == BlockerCauseUnchangedVerificationResult ||
		c == BlockerCauseUnchangedTestImplementationLoop
}

func (c BlockerCause) IsValid() bool {
	return c == BlockerCauseRecoveryPartiallyCompleted || c == BlockerCauseRecoveryConflicting || c.IsVerificationBrake() || c == BlockerCauseFileScopeDecision
}

type BlockerCondition struct {
	Kind                  BlockerConditionKind `json:"kind"`
	ExpectedBindingDigest Digest               `json:"expected_binding_digest"`
	ScopeRequestID        ID                   `json:"scope_request_id,omitempty"`
}

type BlockerResolutionPayload struct {
	BlockerID             ID                      `json:"blocker_id"`
	Condition             BlockerCondition        `json:"condition"`
	ObservedBindingDigest Digest                  `json:"observed_binding_digest"`
	FileScopeDecision     *FileScopeDecisionInput `json:"file_scope_decision,omitempty"`
}

func (c BlockerCondition) Validate() error {
	if !c.Kind.IsValid() || validateDigest(c.ExpectedBindingDigest) != nil {
		return ErrInvalidArgument
	}
	if c.Kind == BlockerConditionResolveFileScope {
		if !c.ScopeRequestID.IsValid() {
			return ErrInvalidArgument
		}
	} else if c.ScopeRequestID != "" {
		return ErrInvalidArgument
	}
	return nil
}

type ProcessBlocker struct {
	BlockerID             ID               `json:"blocker_id"`
	Code                  ErrorCode        `json:"code"`
	Cause                 BlockerCause     `json:"cause"`
	Message               string           `json:"message"`
	ResumeNode            NodeID           `json:"resume_node"`
	ObservedBindingDigest Digest           `json:"observed_binding_digest"`
	Condition             BlockerCondition `json:"condition"`
	RequiredResolution    string           `json:"required_resolution"`
	CreatedAt             time.Time        `json:"created_at"`
}

func (b ProcessBlocker) Validate() error {
	if validateID(b.BlockerID) != nil || b.Code != ErrorTaskBlocked ||
		!b.Cause.IsValid() ||
		!b.ResumeNode.Normal() ||
		requireNormalizedText(b.Message, MaxBlockerMessageBytes, true) != nil ||
		validateDigest(b.ObservedBindingDigest) != nil || b.Condition.Validate() != nil ||
		requireNormalizedText(b.RequiredResolution, MaxResolutionTextBytes, true) != nil ||
		validateUTC(b.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	expectedCondition := BlockerConditionRestoreIssuanceBinding
	if b.Cause.IsVerificationBrake() {
		expectedCondition = BlockerConditionAllowVerificationRetry
	} else if b.Cause == BlockerCauseFileScopeDecision {
		expectedCondition = BlockerConditionResolveFileScope
	}
	if b.Condition.Kind != expectedCondition {
		return ErrInvalidArgument
	}
	return nil
}
