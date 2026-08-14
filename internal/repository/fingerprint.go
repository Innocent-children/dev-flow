package repository

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"hash"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

const (
	commonDirectoryDigestDomain = "dev-flow/git-common-dir/v1"
	repositoryIdentityDomain    = "dev-flow/repository-identity/v1"
	worktreeFingerprintDomain   = "dev-flow/worktree-fingerprint/v1"
	repositoryBindingDomain     = "dev-flow/repository-binding/v1"
)

func digestGitCommonDirectory(canonicalCommonDirectory string) domain.Digest {
	return digestFields(commonDirectoryDigestDomain, []byte(canonicalCommonDirectory))
}

func digestRepositoryIdentity(canonicalRoot string, commonDirectoryDigest domain.Digest) domain.Digest {
	return digestFields(
		repositoryIdentityDomain,
		[]byte(canonicalRoot),
		[]byte(commonDirectoryDigest),
	)
}

func fingerprintWorktree(statusPorcelainV2 []byte) domain.Digest {
	return digestFields(worktreeFingerprintDomain, statusPorcelainV2)
}

func digestRepositoryBinding(binding domain.RepositoryBinding) domain.Digest {
	branchPresent, branch := optionalString(binding.Branch)
	headPresent, head := optionalString(binding.Head)

	return digestFields(
		repositoryBindingDomain,
		[]byte(binding.CanonicalRoot),
		[]byte(binding.GitCommonDirDigest),
		[]byte(binding.RepositoryIdentity),
		[]byte{branchPresent},
		[]byte(branch),
		boolByte(binding.Detached),
		[]byte{headPresent},
		[]byte(head),
		boolByte(binding.Unborn),
		[]byte(binding.WorktreeFingerprint),
	)
}

func optionalString(value *string) (byte, string) {
	if value == nil {
		return 0, ""
	}
	return 1, *value
}

func boolByte(value bool) []byte {
	if value {
		return []byte{1}
	}
	return []byte{0}
}

func digestFields(domainSeparator string, fields ...[]byte) domain.Digest {
	digest := sha256.New()
	writeDigestField(digest, []byte(domainSeparator))
	for _, field := range fields {
		writeDigestField(digest, field)
	}
	return domain.Digest(hex.EncodeToString(digest.Sum(nil)))
}

func writeDigestField(destination hash.Hash, value []byte) {
	var length [8]byte
	binary.BigEndian.PutUint64(length[:], uint64(len(value)))
	_, _ = destination.Write(length[:])
	_, _ = destination.Write(value)
}
