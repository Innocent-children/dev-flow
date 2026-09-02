package comprehensive_test

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestRecoveryFiveClassDecisionTableAndPrecedence(t *testing.T) {
	digestA := domain.Digest(strings.Repeat("a", 64))
	digestB := domain.Digest(strings.Repeat("b", 64))
	actionID := domain.ID("action-recovery")
	observedAt := time.Unix(100, 0).UTC()
	base := recovery.ClassificationFacts{
		Operation: domain.OperationReference{
			OperationID:             "operation-recovery",
			Process:                 workflow.StandardProcess().Reference,
			SourceCursor:            domain.NodeRefactor,
			ExpectedRevision:        1,
			ActionID:                actionID,
			ActionKind:              domain.ActionCompleteRefactor,
			RepositoryBindingDigest: digestA,
		},
		TaskRevision:               1,
		CurrentNode:                domain.NodeRefactor,
		CurrentActionID:            &actionID,
		IssuanceBindingDigest:      digestA,
		AuthoritativeBindingDigest: digestA,
		ObservedBindingDigest:      digestA,
		RepositoryRelation:         recovery.RepositoryExact,
		LastOperationRelation:      recovery.LastOperationUnrelated,
		OperationEvidence:          recovery.OperationEvidenceNone,
		OperationPayloadDigest:     &digestB,
		SourceCurrent:              true,
		PayloadRetained:            true,
		ObservedAt:                 observedAt,
	}

	cases := []struct {
		name           string
		modify         func(*recovery.ClassificationFacts)
		classification domain.RecoveryClassification
		directive      recovery.MutationDirective
		advice         recovery.RecoveryAdvice
	}{
		{"not started", func(*recovery.ClassificationFacts) {}, domain.RecoveryNotStarted, recovery.DirectiveNoWrite, recovery.AdviceRetryCurrentAction},
		{"completed but unrecorded", func(facts *recovery.ClassificationFacts) {
			facts.RepositoryRelation = recovery.RepositoryWorktreeOnlyChanged
			facts.ObservedBindingDigest = digestB
			facts.OperationEvidence = recovery.OperationEvidenceComplete
		}, domain.RecoveryCompletedButUnrecorded, recovery.DirectiveCommitRecoveredTransition, recovery.AdviceSubmitRecoveryApply},
		{"partially completed", func(facts *recovery.ClassificationFacts) {
			facts.RepositoryRelation = recovery.RepositoryWorktreeOnlyChanged
			facts.ObservedBindingDigest = digestB
			facts.OperationEvidence = recovery.OperationEvidencePartial
		}, domain.RecoveryPartiallyCompleted, recovery.DirectiveCreateBlocker, recovery.AdviceSubmitRecoveryApply},
		{"conflicting", func(facts *recovery.ClassificationFacts) {
			facts.RepositoryRelation = recovery.RepositoryForbiddenChange
			facts.ObservedBindingDigest = digestB
			facts.OperationEvidence = recovery.OperationEvidenceContradictory
		}, domain.RecoveryConflicting, recovery.DirectiveCreateBlocker, recovery.AdviceSubmitRecoveryApply},
		{"completed and recorded", func(facts *recovery.ClassificationFacts) {
			facts.TaskRevision = 2
			facts.CurrentNode = domain.NodeTest
			facts.SourceCurrent = false
			facts.LastOperationRelation = recovery.LastOperationExact
			facts.CommittedProof = &recovery.CommittedOperationProof{
				OperationID: "operation-recovery", Kind: domain.OperationApplyAction, ActionID: actionID,
				FromRevision: 1, ToRevision: 2, PayloadDigest: digestB, CommittedAt: observedAt,
			}
		}, domain.RecoveryCompletedAndRecorded, recovery.DirectiveNoWrite, recovery.AdviceReadNextAction},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			facts := base
			testCase.modify(&facts)
			decision, err := recovery.Classify(facts)
			if err != nil {
				t.Fatal(err)
			}
			if decision.Assessment.Classification != testCase.classification || decision.Directive != testCase.directive || decision.Assessment.NextAdvice != testCase.advice {
				t.Fatalf("classification=%s directive=%s advice=%s", decision.Assessment.Classification, decision.Directive, decision.Assessment.NextAdvice)
			}
		})
	}

	precedence := base
	precedence.LastOperationRelation = recovery.LastOperationExact
	precedence.OperationEvidence = recovery.OperationEvidenceContradictory
	precedence.RepositoryRelation = recovery.RepositoryForbiddenChange
	precedence.CommittedProof = &recovery.CommittedOperationProof{
		OperationID: "operation-recovery", Kind: domain.OperationApplyAction, ActionID: actionID,
		FromRevision: 1, ToRevision: 2, PayloadDigest: digestB, CommittedAt: observedAt,
	}
	decision, err := recovery.Classify(precedence)
	if err != nil || decision.Assessment.Classification != domain.RecoveryCompletedAndRecorded {
		t.Fatalf("committed operation did not take precedence: decision=%#v err=%v", decision, err)
	}
}

func TestStorageBootstrapReopenAndCorruptionAreBounded(t *testing.T) {
	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "data", "dev-flow.db")
	if err := os.MkdirAll(filepath.Dir(databasePath), 0o700); err != nil {
		t.Fatal(err)
	}
	database, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	first, err := os.ReadFile(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err := reopened.Close(); err != nil {
		t.Fatal(err)
	}
	second, err := os.ReadFile(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != string(second) {
		t.Fatal("read-only reopen changed the database bytes")
	}

	corruptPath := filepath.Join(t.TempDir(), "corrupt.db")
	corrupt := []byte("not a sqlite database\nprivate=/Users/example")
	if err := os.WriteFile(corruptPath, corrupt, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Open(ctx, corruptPath); err == nil {
		t.Fatal("corrupt storage was accepted")
	}
	after, err := os.ReadFile(corruptPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(corrupt) {
		t.Fatal("corrupt storage rejection changed the file")
	}
}

func TestRepositoryTestSurfacesHaveExecutableCoverage(t *testing.T) {
	root := repositoryRoot(t)
	patterns := map[string][]string{
		"Core domain and workflow": {"internal/domain/*_test.go", "internal/workflow/*_test.go", "internal/application/*_test.go"},
		"storage and recovery":     {"internal/store/*_test.go", "internal/recovery/*_test.go", "internal/repository/*_test.go"},
		"MCP and WebUI":            {"internal/mcp/*_test.go", "internal/webui/*_test.go"},
		"repository contracts":     {"tests/contract/*_test.go"},
		"deterministic journeys":   {"tests/journeys/*_test.go", "tests/journeys/**/*.test.mjs"},
		"Codex adapter":            {"packages/codex/tests/*.test.mjs"},
		"DeepSeek adapter":         {"packages/deepseek/tests/*.test.mjs"},
		"lifecycle manager":        {"packages/dev-flow/tests/*.test.mjs"},
		"build and release":        {"scripts/*.test.mjs", "release/*.test.mjs", "tests/release_workflow.test.mjs"},
	}
	for surface, globs := range patterns {
		t.Run(surface, func(t *testing.T) {
			matches := 0
			for _, pattern := range globs {
				found, err := filepath.Glob(filepath.Join(root, filepath.FromSlash(pattern)))
				if err != nil {
					t.Fatal(err)
				}
				matches += len(found)
			}
			if matches == 0 {
				t.Fatalf("no executable tests found for %s", surface)
			}
		})
	}
}

func TestCoreSemanticSourceContainsNoPlatformOrGitMutationAuthority(t *testing.T) {
	root := repositoryRoot(t)
	platformDecision := regexp.MustCompile(`runtime\.GOOS|//go:build|golang\.org/x/sys/windows|syscall\.`)
	gitMutation := regexp.MustCompile(`(?m)["'](?:commit|push|merge|rebase|tag|reset|clean|stash|checkout|switch)["']`)
	for _, directory := range []string{"internal/domain", "internal/workflow", "internal/application", "internal/recovery"} {
		err := filepath.WalkDir(filepath.Join(root, directory), func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() || filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			raw, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if platformDecision.Match(raw) {
				t.Errorf("Core semantic source branches on the operating system: %s", filepath.ToSlash(path))
			}
			if gitMutation.Match(raw) {
				t.Errorf("Core semantic source contains a Git mutation command: %s", filepath.ToSlash(path))
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestWebUIAndReleaseSafetyBoundariesRemainExplicit(t *testing.T) {
	runtimeSource := string(readRepositoryFile(t, "internal/webui/runtime.go"))
	serverSource := string(readRepositoryFile(t, "internal/webui/server.go"))
	sessionSource := string(readRepositoryFile(t, "internal/webui/session.go"))
	mutationSource := string(readRepositoryFile(t, "internal/webui/action_handlers.go")) + string(readRepositoryFile(t, "internal/webui/lifecycle_handlers.go"))
	boundarySource := runtimeSource + serverSource + sessionSource + mutationSource
	if !strings.Contains(serverSource, "127.0.0.1") || !strings.Contains(serverSource, `net.Listen("tcp4"`) {
		t.Fatal("WebUI no longer has an explicit loopback binding")
	}
	for _, marker := range []string{"Origin", "session", "revision"} {
		if !strings.Contains(boundarySource, marker) && !strings.Contains(strings.ToLower(boundarySource), strings.ToLower(marker)) {
			t.Fatalf("WebUI safety marker %q is missing", marker)
		}
	}

	workflow := string(readRepositoryFile(t, ".github/workflows/publish-npm.yml"))
	for _, marker := range []string{"workflow_dispatch:", "group: npm-release", "cancel-in-progress: false", "persist-credentials: false"} {
		if !strings.Contains(workflow, marker) {
			t.Fatalf("release workflow safety marker %q is missing", marker)
		}
	}
	for _, forbidden := range []string{"pull_request:", "schedule:", "NODE_AUTH_TOKEN", "NPM_TOKEN"} {
		if strings.Contains(workflow, forbidden) {
			t.Fatalf("release workflow contains forbidden automatic or long-lived credential marker %q", forbidden)
		}
	}
}

func TestPackageAndRuntimeAuthoritiesRemainMachineReadable(t *testing.T) {
	for _, relative := range []string{"packages/codex/package.json", "packages/deepseek/package.json", "packages/dev-flow/package.json", "packages/webui/package.json"} {
		manifest := decodeJSONObject(t, readRepositoryFile(t, relative))
		if manifest["name"] == "" || manifest["scripts"] == nil {
			t.Fatalf("%s is missing name or scripts", relative)
		}
		raw, err := json.Marshal(manifest)
		if err != nil || !json.Valid(raw) {
			t.Fatalf("%s is not stable machine-readable JSON", relative)
		}
	}
	for _, relative := range []string{"packages/codex/lib/platform.mjs", "packages/deepseek/lib/platform.mjs", "packages/dev-flow/lib/platform.mjs", "scripts/build-core-runtimes.mjs"} {
		source := string(readRepositoryFile(t, relative))
		for _, runtimeKey := range []string{"darwin-arm64", "win32-x64"} {
			if strings.Count(source, runtimeKey) == 0 {
				t.Fatalf("%s is missing %s", relative, runtimeKey)
			}
		}
	}
}
