package repository

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"hash"
	"sort"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

const (
	commonDirectoryDigestDomain = "dev-flow/git-common-dir/v1"
	repositoryIdentityDomain    = "dev-flow/repository-identity/v1"
	worktreeFingerprintDomain   = "dev-flow/worktree-fingerprint/v1"
	repositoryBindingDomain     = "dev-flow/repository-binding/v1"
	missingContentIdentity      = "missing"
	gitObjectContentPrefix      = "git-object:"
	gitlinkContentPrefix        = "gitlink-object:"
)

type porcelainRecord struct {
	kind         string
	fields       []string
	path         string
	submodule    string
	worktreeMode string
}

func (record porcelainRecord) contentMissing() bool {
	return record.kind != "?" && record.worktreeMode == "000000"
}

func (record porcelainRecord) dirtySubmodule() bool {
	if record.kind == "u" && record.gitlink() {
		return true
	}
	return len(record.submodule) == 4 && record.submodule[0] == 'S' && record.submodule != "S..."
}

func (record porcelainRecord) gitlink() bool {
	for _, field := range record.fields {
		if field == "160000" {
			return true
		}
	}
	return false
}

func (record porcelainRecord) cleanGitlinkObjectID() (string, bool) {
	if record.kind != "1" || len(record.fields) != 8 || record.dirtySubmodule() {
		return "", false
	}
	for _, candidate := range []struct {
		modeIndex int
		oidIndex  int
	}{
		{modeIndex: 4, oidIndex: 7},
		{modeIndex: 3, oidIndex: 6},
	} {
		objectID := record.fields[candidate.oidIndex]
		if record.fields[candidate.modeIndex] == "160000" &&
			validGitObjectID(objectID) && objectID != strings.Repeat("0", len(objectID)) {
			return objectID, true
		}
	}
	return "", false
}

type worktreeFingerprintRecord struct {
	status          porcelainRecord
	contentIdentity string
}

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

func fingerprintWorktree(records []worktreeFingerprintRecord) domain.Digest {
	normalized := append([]worktreeFingerprintRecord(nil), records...)
	sort.Slice(normalized, func(left, right int) bool {
		leftKey := normalized[left].status.canonicalKey()
		rightKey := normalized[right].status.canonicalKey()
		if comparison := bytes.Compare(leftKey, rightKey); comparison != 0 {
			return comparison < 0
		}
		return normalized[left].contentIdentity < normalized[right].contentIdentity
	})

	digest := sha256.New()
	writeDigestField(digest, []byte(worktreeFingerprintDomain))
	var count [8]byte
	binary.BigEndian.PutUint64(count[:], uint64(len(normalized)))
	_, _ = digest.Write(count[:])
	for _, record := range normalized {
		writeDigestField(digest, record.status.canonicalKey())
		writeDigestField(digest, []byte(record.contentIdentity))
	}
	return domain.Digest(hex.EncodeToString(digest.Sum(nil)))
}

func parsePorcelainV2(output []byte) ([]porcelainRecord, error) {
	if len(output) == 0 {
		return nil, nil
	}
	if output[len(output)-1] != 0 {
		return nil, ErrGitObservation
	}

	rawRecords := bytes.Split(output[:len(output)-1], []byte{0})
	records := make([]porcelainRecord, 0, len(rawRecords))
	paths := make(map[string]struct{}, len(rawRecords))
	for _, rawRecord := range rawRecords {
		if len(rawRecord) == 0 {
			return nil, ErrGitObservation
		}
		record, err := parsePorcelainRecord(rawRecord)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
		paths[record.path] = struct{}{}
		if len(paths) > domain.MaxFingerprintPaths {
			return nil, ErrFingerprintPathLimit
		}
	}
	return records, nil
}

func parsePorcelainRecord(rawRecord []byte) (porcelainRecord, error) {
	switch {
	case bytes.HasPrefix(rawRecord, []byte("1 ")):
		parts := bytes.SplitN(rawRecord, []byte{' '}, 9)
		if len(parts) != 9 || !validXY(parts[1]) || !validSubmoduleField(parts[2]) ||
			!validModes(parts[3:6]) || !validObjectIDs(parts[6:8]) || len(parts[8]) == 0 {
			return porcelainRecord{}, ErrGitObservation
		}
		return newPorcelainRecord(parts[:8], parts[8], parts[2], parts[5]), nil
	case bytes.HasPrefix(rawRecord, []byte("u ")):
		parts := bytes.SplitN(rawRecord, []byte{' '}, 11)
		if len(parts) != 11 || !validXY(parts[1]) || !validSubmoduleField(parts[2]) ||
			!validModes(parts[3:7]) || !validObjectIDs(parts[7:10]) || len(parts[10]) == 0 {
			return porcelainRecord{}, ErrGitObservation
		}
		return newPorcelainRecord(parts[:10], parts[10], parts[2], parts[6]), nil
	case bytes.HasPrefix(rawRecord, []byte("? ")):
		if len(rawRecord) == 2 {
			return porcelainRecord{}, ErrGitObservation
		}
		return porcelainRecord{kind: "?", fields: []string{"?"}, path: string(rawRecord[2:])}, nil
	default:
		// Rename/copy records are disabled at the command boundary, and branch,
		// ignored, or unknown record forms are not part of this closed parser.
		return porcelainRecord{}, ErrGitObservation
	}
}

func newPorcelainRecord(fields [][]byte, path, submodule, worktreeMode []byte) porcelainRecord {
	normalizedFields := make([]string, len(fields))
	for index, field := range fields {
		normalizedFields[index] = string(field)
	}
	return porcelainRecord{
		kind:         normalizedFields[0],
		fields:       normalizedFields,
		path:         string(path),
		submodule:    string(submodule),
		worktreeMode: string(worktreeMode),
	}
}

func validXY(value []byte) bool {
	if len(value) != 2 || bytes.Equal(value, []byte("..")) {
		return false
	}
	for _, status := range value {
		if !bytes.ContainsRune([]byte(".MTADRCU"), rune(status)) {
			return false
		}
	}
	return true
}

func validSubmoduleField(value []byte) bool {
	if bytes.Equal(value, []byte("N...")) {
		return true
	}
	return len(value) == 4 && value[0] == 'S' &&
		(value[1] == '.' || value[1] == 'C') &&
		(value[2] == '.' || value[2] == 'M') &&
		(value[3] == '.' || value[3] == 'U')
}

func validModes(values [][]byte) bool {
	for _, value := range values {
		if len(value) != 6 {
			return false
		}
		for _, character := range value {
			if character < '0' || character > '7' {
				return false
			}
		}
	}
	return true
}

func validObjectIDs(values [][]byte) bool {
	for _, value := range values {
		if !validGitObjectID(string(value)) {
			return false
		}
	}
	return true
}

func validGitObjectID(value string) bool {
	if len(value) != 40 && len(value) != 64 {
		return false
	}
	for _, character := range []byte(value) {
		if (character < '0' || character > '9') && (character < 'a' || character > 'f') {
			return false
		}
	}
	return true
}

func (record porcelainRecord) canonicalKey() []byte {
	var key bytes.Buffer
	for _, field := range record.fields {
		writeBufferField(&key, []byte(field))
	}
	writeBufferField(&key, []byte(record.path))
	return key.Bytes()
}

func writeBufferField(destination *bytes.Buffer, value []byte) {
	var length [8]byte
	binary.BigEndian.PutUint64(length[:], uint64(len(value)))
	_, _ = destination.Write(length[:])
	_, _ = destination.Write(value)
}

func ensureStatusUnchanged(first, second []porcelainRecord) error {
	firstKeys := canonicalStatusKeys(first)
	secondKeys := canonicalStatusKeys(second)
	if len(firstKeys) != len(secondKeys) {
		return ErrInconsistentWorktree
	}
	for index := range firstKeys {
		if !bytes.Equal(firstKeys[index], secondKeys[index]) {
			return ErrInconsistentWorktree
		}
	}
	return nil
}

func normalizedPorcelainRecords(records []porcelainRecord) []porcelainRecord {
	normalized := append([]porcelainRecord(nil), records...)
	sort.Slice(normalized, func(left, right int) bool {
		return bytes.Compare(normalized[left].canonicalKey(), normalized[right].canonicalKey()) < 0
	})
	return normalized
}

func ensureNoDirtySubmodules(records []porcelainRecord) error {
	for _, record := range records {
		if record.dirtySubmodule() {
			return ErrDirtySubmodule
		}
	}
	return nil
}

func canonicalStatusKeys(records []porcelainRecord) [][]byte {
	keys := make([][]byte, len(records))
	for index, record := range records {
		keys[index] = record.canonicalKey()
	}
	sort.Slice(keys, func(left, right int) bool { return bytes.Compare(keys[left], keys[right]) < 0 })
	return keys
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
