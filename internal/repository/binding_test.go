package repository

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

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
		{name: "canonical root changed without digest update", mutate: func(value *domain.RepositoryBinding) { value.CanonicalRoot = "/public/other" }},
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

func selfConsistentBinding() domain.RepositoryBinding {
	branch := "main"
	head := strings.Repeat("1", 40)
	common := digestGitCommonDirectory("/public/example/.git")
	binding := domain.RepositoryBinding{
		CanonicalRoot:       "/public/example",
		GitCommonDirDigest:  common,
		RepositoryIdentity:  digestRepositoryIdentity("/public/example", common),
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
