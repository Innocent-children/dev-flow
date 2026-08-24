package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"hash"
	"sort"
	"time"
)

type RepositoryKey string

const (
	DefaultPrimaryRepositoryKey RepositoryKey = "primary"
	repositoryScopeDigestDomain               = "dev-flow/repository-scope-binding/v1"
)

func (k RepositoryKey) IsValid() bool {
	if len(k) == 0 || len(k) > MaxRepositoryKeyBytes {
		return false
	}
	for i, character := range []byte(k) {
		if character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || i > 0 && (character == '.' || character == '_' || character == '-') {
			continue
		}
		return false
	}
	return true
}

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

type RepositoryScopeEntry struct {
	Key     RepositoryKey     `json:"key"`
	Binding RepositoryBinding `json:"binding"`
}

func (e RepositoryScopeEntry) Validate() error {
	if !e.Key.IsValid() || e.Binding.Validate() != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (e RepositoryScopeEntry) Clone() RepositoryScopeEntry {
	e.Binding = e.Binding.Clone()
	return e
}

func NormalizeRepositoryScope(primaryKey RepositoryKey, primary RepositoryBinding, additional []RepositoryScopeEntry) (RepositoryKey, []RepositoryScopeEntry, error) {
	if primaryKey == "" {
		primaryKey = DefaultPrimaryRepositoryKey
	}
	entries := make([]RepositoryScopeEntry, len(additional))
	for i := range additional {
		entries[i] = additional[i].Clone()
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Key < entries[j].Key })
	if err := validateRepositoryScope(primaryKey, primary, entries); err != nil {
		return "", nil, err
	}
	return primaryKey, entries, nil
}

func validateRepositoryScope(primaryKey RepositoryKey, primary RepositoryBinding, additional []RepositoryScopeEntry) error {
	if !primaryKey.IsValid() || primary.Validate() != nil || len(additional) > MaxAdditionalRepositories {
		return ErrInvalidArgument
	}
	keys := map[RepositoryKey]bool{primaryKey: true}
	identities := map[Digest]bool{primary.RepositoryIdentity: true}
	previous := RepositoryKey("")
	for _, entry := range additional {
		if entry.Validate() != nil || keys[entry.Key] || identities[entry.Binding.RepositoryIdentity] || previous != "" && entry.Key <= previous {
			return ErrInvalidArgument
		}
		keys[entry.Key] = true
		identities[entry.Binding.RepositoryIdentity] = true
		previous = entry.Key
	}
	return nil
}

func effectiveRepositoryBindingDigest(primaryKey RepositoryKey, primary RepositoryBinding, additional []RepositoryScopeEntry) (Digest, error) {
	if primaryKey == "" {
		primaryKey = DefaultPrimaryRepositoryKey
	}
	if err := validateRepositoryScope(primaryKey, primary, additional); err != nil {
		return "", err
	}
	if len(additional) == 0 {
		return primary.BindingDigest, nil
	}
	digest := sha256.New()
	writeRepositoryScopeDigestField(digest, []byte(repositoryScopeDigestDomain))
	var count [8]byte
	binary.BigEndian.PutUint64(count[:], uint64(len(additional)+1))
	writeRepositoryScopeDigestField(digest, count[:])
	writeRepositoryScopeDigestEntry(digest, "primary", primaryKey, primary.BindingDigest)
	for _, entry := range additional {
		writeRepositoryScopeDigestEntry(digest, "additional", entry.Key, entry.Binding.BindingDigest)
	}
	return Digest(hex.EncodeToString(digest.Sum(nil))), nil
}

func writeRepositoryScopeDigestEntry(destination hash.Hash, role string, key RepositoryKey, digest Digest) {
	writeRepositoryScopeDigestField(destination, []byte(role))
	writeRepositoryScopeDigestField(destination, []byte(key))
	writeRepositoryScopeDigestField(destination, []byte(digest))
}

func writeRepositoryScopeDigestField(destination hash.Hash, value []byte) {
	var length [8]byte
	binary.BigEndian.PutUint64(length[:], uint64(len(value)))
	_, _ = destination.Write(length[:])
	_, _ = destination.Write(value)
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
