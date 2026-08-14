package domain

import "time"

// CoreLimitsVersion identifies the fixed limits contract implemented by this package.
const CoreLimitsVersion = "0.1"

const (
	MaxRepositoryPathBytes           = 4_096
	MaxGoalBytes                     = 8_192
	MaxScopeItems                    = 64
	MaxScopeItemBytes                = 1_024
	MaxOutOfScopeItems               = 64
	MaxOutOfScopeItemBytes           = 1_024
	MaxAcceptanceCriteriaItems       = 64
	MaxAcceptanceCriterionBytes      = 2_048
	MaxEvidencePerAction             = 32
	MaxEvidenceNameBytes             = 256
	MaxEvidenceSummaryBytes          = 2_048
	MaxRetainedEvidenceItems         = 256
	MaxBoundedStringListItems        = 64
	MaxBlockerMessageBytes           = 4_096
	MaxReasonBytes                   = 4_096
	MaxGuidanceBytes                 = 4_096
	MaxOutcomeSummaryBytes           = 4_096
	MaxResolutionTextBytes           = 4_096
	MaxErrorMessageBytes             = 4_096
	MaxIdentifierBytes               = 128
	MaxActionPayloadBytes            = 131_072
	MaxResultEnvelopeBytes           = 262_144
	MaxPersistedTaskSnapshotBytes    = 1_048_576
	MaxGitCommandOutputBytes         = 1_048_576
	MaxAutomaticVerificationCommands = 20
	GitCommandTimeout                = 10 * time.Second
	SQLiteBusyTimeout                = 5 * time.Second
)
