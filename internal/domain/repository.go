package domain

import "time"

// RepositoryBinding is one immutable observation of repository identity and worktree state.
type RepositoryBinding struct {
	CanonicalRoot       string    `json:"canonical_root"`
	GitCommonDirDigest  Digest    `json:"git_common_dir_digest"`
	RepositoryIdentity  Digest    `json:"repository_identity"`
	Branch              *string   `json:"branch"`
	Detached            bool      `json:"detached"`
	Head                *string   `json:"head"`
	Unborn              bool      `json:"unborn"`
	WorktreeFingerprint Digest    `json:"worktree_fingerprint"`
	ChangedPaths        []string  `json:"changed_paths"`
	ObservedAt          time.Time `json:"observed_at"`
	BindingDigest       Digest    `json:"binding_digest"`
}

func (b RepositoryBinding) Validate() error {
	if validateCanonicalPath(b.CanonicalRoot) != nil ||
		validateDigest(b.GitCommonDirDigest) != nil ||
		validateDigest(b.RepositoryIdentity) != nil ||
		validateDigest(b.WorktreeFingerprint) != nil ||
		validateDigest(b.BindingDigest) != nil || validateUTC(b.ObservedAt) != nil {
		return ErrInvalidArgument
	}
	if len(b.ChangedPaths) > MaxBoundedStringListItems {
		return ErrInvalidArgument
	}
	seenPaths := map[string]bool{}
	for _, path := range b.ChangedPaths {
		if validateRepositoryRelativePath(path) != nil || seenPaths[path] {
			return ErrInvalidArgument
		}
		seenPaths[path] = true
	}
	if b.Detached {
		if b.Branch != nil {
			return ErrInvalidArgument
		}
	} else {
		if b.Branch == nil || requireNormalizedText(*b.Branch, MaxRepositoryPathBytes, true) != nil {
			return ErrInvalidArgument
		}
	}
	if b.Unborn {
		if b.Head != nil || b.Detached {
			return ErrInvalidArgument
		}
	} else {
		if b.Head == nil || validateObjectID(*b.Head) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

func (b RepositoryBinding) Clone() RepositoryBinding {
	b.Branch = cloneStringPointer(b.Branch)
	b.Head = cloneStringPointer(b.Head)
	b.ChangedPaths = append([]string(nil), b.ChangedPaths...)
	return b
}
