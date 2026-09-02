package domain

import (
	"crypto/sha256"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/testpath"
)

var primitiveTestTime = time.Date(2026, time.August, 14, 1, 2, 3, 0, time.UTC)

func TestIdentifiersAndDigestsAreCanonicalAndBounded(t *testing.T) {
	if !ID(strings.Repeat("i", MaxIdentifierBytes)).IsValid() {
		t.Fatal("identifier at byte limit is invalid")
	}
	for _, value := range []ID{"", ID(strings.Repeat("i", MaxIdentifierBytes+1)), " id", "id ", "id with space"} {
		if value.IsValid() {
			t.Fatalf("invalid identifier %q was accepted", value)
		}
	}

	valid := Digest(strings.Repeat("a", sha256.Size*2))
	if !valid.IsValid() {
		t.Fatal("canonical SHA-256 digest is invalid")
	}
	for _, value := range []Digest{
		"", Digest(strings.Repeat("a", sha256.Size*2-1)),
		Digest(strings.Repeat("A", sha256.Size*2)), Digest(strings.Repeat("z", sha256.Size*2)),
	} {
		if value.IsValid() {
			t.Fatalf("invalid digest %q was accepted", value)
		}
	}
}

func TestCompactJSONSizeUsesCanonicalEscaping(t *testing.T) {
	type projection struct {
		Text string `json:"text"`
	}
	empty, err := compactJSONSize(projection{})
	if err != nil {
		t.Fatal(err)
	}
	html, err := compactJSONSize(projection{Text: "<>&"})
	if err != nil {
		t.Fatal(err)
	}
	required, err := compactJSONSize(projection{Text: "\\\""})
	if err != nil {
		t.Fatal(err)
	}
	if html-empty != 3 || required-empty != 4 {
		t.Fatalf("escaping sizes html=%d required=%d", html-empty, required-empty)
	}
}

func TestVerificationBudgetBoundaries(t *testing.T) {
	for _, commands := range []int{0, MaxAutomaticVerificationCommands} {
		budget := VerificationBudget{Level: VerificationTargeted, MaxAutomaticCommands: commands}
		if err := budget.Validate(); err != nil {
			t.Fatalf("command boundary %d rejected: %v", commands, err)
		}
	}
	for _, budget := range []VerificationBudget{
		{Level: VerificationLevel("TARGETED")},
		{Level: VerificationTargeted, MaxAutomaticCommands: -1},
		{Level: VerificationTargeted, MaxAutomaticCommands: MaxAutomaticVerificationCommands + 1},
	} {
		if !errors.Is(budget.Validate(), ErrInvalidArgument) {
			t.Fatalf("invalid budget %#v was accepted", budget)
		}
	}
}

func TestRepositoryBindingInvariants(t *testing.T) {
	normal := validCurrentRepositoryBinding()
	if err := normal.Validate(); err != nil {
		t.Fatalf("valid repository binding rejected: %v", err)
	}

	unborn := normal
	unborn.Head = nil
	unborn.Unborn = true
	if err := unborn.Validate(); err != nil {
		t.Fatalf("valid unborn repository rejected: %v", err)
	}
	detached := normal
	detached.Branch = nil
	detached.Detached = true
	if err := detached.Validate(); err != nil {
		t.Fatalf("valid detached repository rejected: %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*RepositoryBinding)
	}{
		{name: "detached with branch", mutate: func(b *RepositoryBinding) { b.Detached = true }},
		{name: "attached without branch", mutate: func(b *RepositoryBinding) { b.Branch = nil }},
		{name: "unborn with head", mutate: func(b *RepositoryBinding) { b.Unborn = true }},
		{name: "born without head", mutate: func(b *RepositoryBinding) { b.Head = nil }},
		{name: "relative root", mutate: func(b *RepositoryBinding) { b.CanonicalRoot = "relative/repo" }},
		{name: "unclean root", mutate: func(b *RepositoryBinding) {
			b.CanonicalRoot += string(filepath.Separator) + "child" + string(filepath.Separator) + ".."
		}},
		{name: "uppercase digest", mutate: func(b *RepositoryBinding) { b.BindingDigest = Digest(strings.Repeat("A", sha256.Size*2)) }},
		{name: "zero observation", mutate: func(b *RepositoryBinding) { b.ObservedAt = time.Time{} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			candidate := normal.Clone()
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid repository binding was accepted: %#v", candidate)
			}
		})
	}

	clone := normal.Clone()
	*clone.Branch = "mutated"
	*clone.Head = strings.Repeat("b", 40)
	if *normal.Branch != "main" || *normal.Head != strings.Repeat("a", 40) {
		t.Fatal("repository clone retained pointer aliases")
	}
}

func TestRepositoryKeyAndContractPathSyntax(t *testing.T) {
	for _, key := range []RepositoryKey{"primary", "docs.v1", "repo_name", "repo-name"} {
		if !key.IsValid() {
			t.Fatalf("valid repository key %q was rejected", key)
		}
	}
	for _, key := range []RepositoryKey{"", "Primary", ".docs", "docs/key", "docs::api", "docs key"} {
		if key.IsValid() {
			t.Fatalf("invalid repository key %q was accepted", key)
		}
	}
	for _, path := range []string{"internal/domain/task.go", "core::internal/domain/task.go"} {
		if err := ValidateRepositoryContractPath(path); err != nil {
			t.Fatalf("valid contract path %q: %v", path, err)
		}
	}
	for _, path := range []string{"", "/absolute", "../escape", `internal\domain\task.go`, "Core::README.md", "core::", "core::../escape", "core::nested::file"} {
		if err := ValidateRepositoryContractPath(path); err == nil {
			t.Fatalf("invalid contract path %q was accepted", path)
		}
	}
}

func TestEvidenceSummaryInvariants(t *testing.T) {
	evidence := validCurrentEvidence("evidence-1", EvidenceSourceAutomated, 1)
	if err := evidence.Validate(); err != nil {
		t.Fatalf("valid evidence rejected: %v", err)
	}
	for _, tc := range []struct {
		name   string
		mutate func(*EvidenceSummary)
	}{
		{name: "unknown source", mutate: func(e *EvidenceSummary) { e.Source = "manual" }},
		{name: "unknown status", mutate: func(e *EvidenceSummary) { e.Status = "success" }},
		{name: "unnormalized summary", mutate: func(e *EvidenceSummary) { e.Summary = " summary " }},
		{name: "negative command count", mutate: func(e *EvidenceSummary) { e.CommandCount = -1 }},
		{name: "nonautomated commands", mutate: func(e *EvidenceSummary) { e.Source = EvidenceSourceStatic; e.CommandCount = 1 }},
		{name: "nonautomated full suite", mutate: func(e *EvidenceSummary) { e.Source = EvidenceSourceUser; e.CommandCount = 0; e.FullSuite = true }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			candidate := evidence
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid evidence was accepted: %#v", candidate)
			}
		})
	}
}

func TestLastOperationKindAndActionIdentity(t *testing.T) {
	actionID := ID("action-1")
	base := LastOperation{OperationID: "operation-1", Kind: OperationApplyAction, ActionID: &actionID, FromRevision: 1, ToRevision: 2, PayloadDigest: primitiveDigest("a"), CommittedAt: primitiveTestTime}
	if err := base.Validate(); err != nil {
		t.Fatalf("valid apply operation rejected: %v", err)
	}
	for _, tc := range []struct {
		name   string
		mutate func(*LastOperation)
	}{
		{name: "apply without action", mutate: func(o *LastOperation) { o.ActionID = nil }},
		{name: "apply from zero", mutate: func(o *LastOperation) { o.FromRevision = 0; o.ToRevision = 1 }},
		{name: "unknown kind", mutate: func(o *LastOperation) { o.Kind = "resume_task" }},
		{name: "nonconsecutive revision", mutate: func(o *LastOperation) { o.ToRevision++ }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			candidate := base
			tc.mutate(&candidate)
			if !errors.Is(candidate.Validate(), ErrInvalidArgument) {
				t.Fatalf("invalid operation was accepted: %#v", candidate)
			}
		})
	}
}

func TestStableTypedErrors(t *testing.T) {
	for _, code := range []ErrorCode{
		ErrorInvalidArgument, ErrorNotGitRepository, ErrorTaskNotFound, ErrorActiveTaskConflict,
		ErrorHostOwnershipConflict, ErrorRevisionConflict, ErrorActionStale, ErrorRepositoryDrift,
		ErrorVerificationBudgetExceeded, ErrorTaskBlocked, ErrorTaskTerminal, ErrorSchemaUnsupported,
		ErrorProcessUnsupported, ErrorTransitionNotAllowed, ErrorRecoveryUnavailable,
		ErrorStorageUnavailable, ErrorInternal,
	} {
		if !code.IsValid() {
			t.Fatalf("stable error code %q is invalid", code)
		}
	}
	err := NewError(ErrorInvalidArgument, "  invalid value  ")
	if err.Code != ErrorInvalidArgument || err.Message != "invalid value" || !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("typed error=%#v", err)
	}
	if unknown := NewError("UNKNOWN", "failure"); unknown.Code != ErrorInternal {
		t.Fatalf("unknown error code mapped to %q", unknown.Code)
	}
}

func validCurrentRepositoryBinding() RepositoryBinding {
	branch := "main"
	head := strings.Repeat("a", 40)
	return RepositoryBinding{
		CanonicalRoot: testpath.Absolute("tmp", "repository"), GitCommonDirDigest: primitiveDigest("a"),
		RepositoryIdentity: primitiveDigest("b"), Branch: &branch, Head: &head,
		WorktreeFingerprint: primitiveDigest("c"), ObservedAt: primitiveTestTime, BindingDigest: primitiveDigest("d"),
	}
}

func validCurrentEvidence(id ID, source EvidenceSource, commands int) EvidenceSummary {
	status := EvidencePassed
	if source == EvidenceSourceHostObserved {
		status = EvidenceObserved
	}
	return EvidenceSummary{EvidenceID: id, Source: source, Name: "check", Status: status, Summary: "summary", Digest: primitiveDigest("e"), CommandCount: commands, RecordedAt: primitiveTestTime}
}

func primitiveDigest(character string) Digest {
	return Digest(strings.Repeat(character, sha256.Size*2))
}
