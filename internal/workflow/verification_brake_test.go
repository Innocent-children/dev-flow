package workflow

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestEvaluateVerificationBrakeRecognizesOnlyExactThreeAttemptPatterns(t *testing.T) {
	now := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	tests := []struct {
		name      string
		attempts  []domain.VerificationAttempt
		evidence  []domain.EvidenceSummary
		wantCause domain.BlockerCause
		wantCheck string
	}{
		{
			name: "same failed check",
			attempts: []domain.VerificationAttempt{
				brakeAttempt(1, 1, brakeDigest("a"), brakeDigest("f"), true, domain.NodeImplement, nil, "evidence-1", now),
				brakeAttempt(2, 2, brakeDigest("b"), brakeDigest("f"), true, domain.NodeImplement, nil, "evidence-2", now),
				brakeAttempt(3, 3, brakeDigest("c"), brakeDigest("f"), true, domain.NodeImplement, nil, "evidence-3", now),
			},
			evidence: []domain.EvidenceSummary{
				brakeEvidence("evidence-1", "auth-test", domain.EvidenceFailed, "same failure", now),
				brakeEvidence("evidence-2", "auth-test", domain.EvidenceFailed, "same failure", now),
				brakeEvidence("evidence-3", "auth-test", domain.EvidenceFailed, "same failure", now),
			},
			wantCause: domain.BlockerCauseRepeatedVerificationFailure,
			wantCheck: "auth-test",
		},
		{
			name: "same complete result",
			attempts: []domain.VerificationAttempt{
				brakeAttempt(1, 1, brakeDigest("d"), "", false, domain.NodeComprehensionReview, nil, "evidence-1", now),
				brakeAttempt(2, 1, brakeDigest("d"), "", false, domain.NodeComprehensionReview, nil, "evidence-2", now),
				brakeAttempt(3, 1, brakeDigest("d"), "", false, domain.NodeComprehensionReview, nil, "evidence-3", now),
			},
			evidence: []domain.EvidenceSummary{
				brakeEvidence("evidence-1", "targeted-test", domain.EvidencePassed, "unchanged", now),
				brakeEvidence("evidence-2", "targeted-test", domain.EvidencePassed, "unchanged", now),
				brakeEvidence("evidence-3", "targeted-test", domain.EvidencePassed, "unchanged", now),
			},
			wantCause: domain.BlockerCauseUnchangedVerificationResult,
		},
		{
			name: "same paths and failure across implementation loop",
			attempts: []domain.VerificationAttempt{
				brakeAttempt(1, 1, brakeDigest("a"), brakeDigest("f"), true, domain.NodeImplement, []string{"internal/auth.go"}, "evidence-1", now),
				brakeAttempt(2, 2, brakeDigest("b"), brakeDigest("f"), true, domain.NodeImplement, []string{"internal/auth.go"}, "evidence-2", now),
				brakeAttempt(3, 3, brakeDigest("c"), brakeDigest("f"), true, domain.NodeImplement, []string{"internal/auth.go"}, "evidence-3", now),
			},
			evidence: []domain.EvidenceSummary{
				brakeEvidence("evidence-1", "probe-a", domain.EvidencePassed, "probe changed", now),
				brakeEvidence("evidence-2", "probe-b", domain.EvidencePassed, "probe changed", now),
				brakeEvidence("evidence-3", "probe-c", domain.EvidencePassed, "probe changed", now),
			},
			wantCause: domain.BlockerCauseUnchangedTestImplementationLoop,
		},
		{
			name: "different failures continue",
			attempts: []domain.VerificationAttempt{
				brakeAttempt(1, 1, brakeDigest("a"), brakeDigest("a"), true, domain.NodeImplement, nil, "evidence-1", now),
				brakeAttempt(2, 2, brakeDigest("b"), brakeDigest("b"), true, domain.NodeImplement, nil, "evidence-2", now),
				brakeAttempt(3, 3, brakeDigest("c"), brakeDigest("c"), true, domain.NodeImplement, nil, "evidence-3", now),
			},
			evidence: []domain.EvidenceSummary{
				brakeEvidence("evidence-1", "auth-test", domain.EvidenceFailed, "first failure", now),
				brakeEvidence("evidence-2", "auth-test", domain.EvidenceFailed, "second failure", now),
				brakeEvidence("evidence-3", "auth-test", domain.EvidenceFailed, "third failure", now),
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision, err := EvaluateVerificationBrake(test.attempts, test.evidence)
			if err != nil {
				t.Fatal(err)
			}
			if decision.Cause != test.wantCause || decision.CheckName != test.wantCheck {
				t.Fatalf("decision=%+v want cause=%s check=%q", decision, test.wantCause, test.wantCheck)
			}
		})
	}
}

func TestEvaluateVerificationBrakeRejectsMissingEvidenceReference(t *testing.T) {
	now := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	attempts := []domain.VerificationAttempt{
		brakeAttempt(1, 1, brakeDigest("a"), "", false, domain.NodeComprehensionReview, nil, "missing-1", now),
		brakeAttempt(2, 1, brakeDigest("a"), "", false, domain.NodeComprehensionReview, nil, "missing-2", now),
		brakeAttempt(3, 1, brakeDigest("a"), "", false, domain.NodeComprehensionReview, nil, "missing-3", now),
	}
	if _, err := EvaluateVerificationBrake(attempts, nil); !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("error=%v", err)
	}
}

func brakeAttempt(taskRevision uint64, implementationRevision uint32, result, failure domain.Digest, failed bool, destination domain.NodeID, paths []string, evidenceID domain.ID, now time.Time) domain.VerificationAttempt {
	return domain.VerificationAttempt{
		TaskRevision: taskRevision, TaskPlanRevision: 1, ImplementationRevision: implementationRevision,
		ContentDigest:   brakeDigest("c"),
		DestinationNode: destination, EvidenceIDs: []domain.ID{evidenceID}, ResultDigest: result,
		FailureDigest: failure, Failed: failed, ImplementationPaths: paths, RecordedAt: now,
	}
}

func brakeEvidence(id domain.ID, name string, status domain.EvidenceStatus, summary string, now time.Time) domain.EvidenceSummary {
	return domain.EvidenceSummary{EvidenceID: id, TaskPlanRevision: 1, Source: domain.EvidenceSourceAutomated, Name: name, Status: status, Summary: summary, Digest: brakeDigest("e"), CommandCount: 1, RecordedAt: now}
}

func brakeDigest(value string) domain.Digest {
	return domain.Digest(strings.Repeat(value, 64))
}
