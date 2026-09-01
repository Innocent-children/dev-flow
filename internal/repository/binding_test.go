package repository

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/testpath"
)

func TestBindingDigestCoversClosedRepositoryComponents(t *testing.T) {
	base := selfConsistentBinding()
	tests := []struct {
		name   string
		mutate func(*domain.RepositoryBinding)
	}{
		{name: "branch", mutate: func(binding *domain.RepositoryBinding) { branch := "feature/component"; binding.Branch = &branch }},
		{name: "detached", mutate: func(binding *domain.RepositoryBinding) { binding.Branch = nil; binding.Detached = true }},
		{name: "HEAD", mutate: func(binding *domain.RepositoryBinding) { head := strings.Repeat("2", 40); binding.Head = &head }},
		{name: "unborn", mutate: func(binding *domain.RepositoryBinding) { binding.Head = nil; binding.Unborn = true }},
		{name: "worktree fingerprint", mutate: func(binding *domain.RepositoryBinding) { binding.WorktreeFingerprint = bindingDigest("4") }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			changed := base.Clone()
			tt.mutate(&changed)
			changed.BindingDigest = digestRepositoryBinding(changed)
			if err := VerifyBindingDigests(changed); err != nil {
				t.Fatalf("changed binding is not self-consistent: %v", err)
			}
			if changed.CanonicalRoot != base.CanonicalRoot ||
				changed.GitCommonDirDigest != base.GitCommonDirDigest ||
				changed.RepositoryIdentity != base.RepositoryIdentity ||
				changed.BindingDigest == base.BindingDigest {
				t.Fatalf("component change did not preserve repository identity or change binding: base=%#v changed=%#v", base, changed)
			}
		})
	}
}

func TestCanonicalRepositoryAliasesConverge(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation is not reliably available without elevated privileges")
	}
	repositoryPath := newCommittedRepository(t, "alias-target")
	subdirectory := filepath.Join(repositoryPath, "nested", "directory")
	if err := os.MkdirAll(subdirectory, 0o755); err != nil {
		t.Fatalf("create repository subdirectory: %v", err)
	}
	aliasRoot := t.TempDir()
	symlinkAlias := filepath.Join(aliasRoot, "repository-link")
	caseVariantAlias := filepath.Join(aliasRoot, "AlIaS-TaRgEt")
	for _, alias := range []string{symlinkAlias, caseVariantAlias} {
		if err := os.Symlink(repositoryPath, alias); err != nil {
			t.Fatalf("create repository alias %q: %v", alias, err)
		}
	}

	observer := NewGitObserver()
	direct := observeRepository(t, observer, repositoryPath)
	for name, path := range map[string]string{
		"real path":          repositoryPath,
		"subdirectory":       subdirectory,
		"symlink alias":      symlinkAlias,
		"case-variant alias": caseVariantAlias,
	} {
		t.Run(name, func(t *testing.T) {
			observed := observeRepository(t, observer, path)
			want := direct.Clone()
			got := observed.Clone()
			want.ObservedAt = time.Time{}
			got.ObservedAt = time.Time{}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("alias did not converge on canonical binding: got=%#v want=%#v", got, want)
			}
		})
	}
}

func TestVerifyBindingDigests(t *testing.T) {
	binding := selfConsistentBinding()
	before := binding.Clone()
	if err := VerifyBindingDigests(binding); err != nil {
		t.Fatalf("VerifyBindingDigests() error = %v", err)
	}
	if !reflect.DeepEqual(binding, before) {
		t.Fatalf("VerifyBindingDigests() mutated input:\nbefore = %#v\nafter  = %#v", before, binding)
	}

	t.Run("observed_at is excluded", func(t *testing.T) {
		changed := binding.Clone()
		changed.ObservedAt = changed.ObservedAt.Add(3 * time.Hour)
		if err := VerifyBindingDigests(changed); err != nil {
			t.Fatalf("observed_at-only change failed: %v", err)
		}
	})

	tests := []struct {
		name   string
		mutate func(*domain.RepositoryBinding)
	}{
		{name: "repository identity tampered", mutate: func(value *domain.RepositoryBinding) { value.RepositoryIdentity = bindingDigest("1") }},
		{name: "binding digest tampered", mutate: func(value *domain.RepositoryBinding) { value.BindingDigest = bindingDigest("2") }},
		{name: "canonical root changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.CanonicalRoot = testpath.Absolute("public", "other") }},
		{name: "common-directory digest changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.GitCommonDirDigest = bindingDigest("3") }},
		{name: "branch changed without digest update", mutate: func(value *domain.RepositoryBinding) { branch := "feature"; value.Branch = &branch }},
		{name: "detached changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.Branch = nil; value.Detached = true }},
		{name: "HEAD changed without digest update", mutate: func(value *domain.RepositoryBinding) { head := strings.Repeat("2", 40); value.Head = &head }},
		{name: "unborn changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.Head = nil; value.Unborn = true }},
		{name: "worktree changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.WorktreeFingerprint = bindingDigest("4") }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			changed := binding.Clone()
			tt.mutate(&changed)
			if err := changed.Validate(); err != nil {
				t.Fatalf("test binding shape is invalid: %v", err)
			}
			if err := VerifyBindingDigests(changed); err == nil {
				t.Fatalf("VerifyBindingDigests() accepted inconsistent binding %#v", changed)
			}
		})
	}

	t.Run("well-formed SHA-256 values are insufficient", func(t *testing.T) {
		inconsistent := binding.Clone()
		inconsistent.RepositoryIdentity = bindingDigest("5")
		inconsistent.BindingDigest = bindingDigest("6")
		if err := inconsistent.Validate(); err != nil {
			t.Fatalf("shape validation failed: %v", err)
		}
		if err := VerifyBindingDigests(inconsistent); err == nil {
			t.Fatal("well-formed but content-inconsistent digests were accepted")
		}
	})
}

func TestRepositoryBindingChangedPathsRemainComponentRelative(t *testing.T) {
	binding := selfConsistentBinding()
	binding.ChangedPaths = []string{"docs::README.md"}
	if err := binding.Validate(); err == nil {
		t.Fatal("repository binding accepted a Scope-qualified changed path")
	}
}

func selfConsistentBinding() domain.RepositoryBinding {
	branch := "main"
	head := strings.Repeat("1", 40)
	root := testpath.Absolute("public", "example")
	common := digestGitCommonDirectory(filepath.Join(root, ".git"))
	binding := domain.RepositoryBinding{
		CanonicalRoot:       root,
		GitCommonDirDigest:  common,
		RepositoryIdentity:  digestRepositoryIdentity(root, common),
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: bindingDigest("a"),
		ObservedAt:          time.Date(2026, time.August, 15, 10, 0, 0, 0, time.UTC),
	}
	binding.BindingDigest = digestRepositoryBinding(binding)
	return binding
}

func bindingDigest(character string) domain.Digest {
	return domain.Digest(strings.Repeat(character, 64))
}
