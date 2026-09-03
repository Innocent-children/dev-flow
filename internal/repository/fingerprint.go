package repository

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"hash"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

var ErrInvalidBindingDigests = errors.New("repository binding digests are inconsistent")

const (
	commonDirectoryDigestDomain      = "dev-flow/git-common-dir"
	worktreeGitDirectoryDigestDomain = "dev-flow/git-worktree-dir"
	worktreeInstanceDigestDomain     = "dev-flow/worktree-instance"
	workspaceIdentityDigestDomain    = "dev-flow/workspace-identity"
	workspaceHistoryDigestDomain     = "dev-flow/workspace-history"
	workspaceContentDigestDomain     = "dev-flow/workspace-content"
	repositoryBindingDomain          = "dev-flow/repository-binding"
	pathContentDigestDomain          = "dev-flow/path-content"
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
	return record.kind == "u" && record.gitlink() || len(record.submodule) == 4 && record.submodule[0] == 'S' && record.submodule != "S..."
}
func (record porcelainRecord) gitlink() bool {
	for _, field := range record.fields {
		if field == "160000" {
			return true
		}
	}
	return false
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
	paths := map[string]struct{}{}
	for _, raw := range rawRecords {
		record, err := parsePorcelainRecord(raw)
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

func parsePorcelainRecord(raw []byte) (porcelainRecord, error) {
	switch {
	case bytes.HasPrefix(raw, []byte("1 ")):
		parts := bytes.SplitN(raw, []byte{' '}, 9)
		if len(parts) != 9 || !validXY(parts[1]) || !validSubmoduleField(parts[2]) || !validModes(parts[3:6]) || !validObjectIDs(parts[6:8]) || len(parts[8]) == 0 {
			return porcelainRecord{}, ErrGitObservation
		}
		return newPorcelainRecord(parts[:8], parts[8], parts[2], parts[5]), nil
	case bytes.HasPrefix(raw, []byte("u ")):
		parts := bytes.SplitN(raw, []byte{' '}, 11)
		if len(parts) != 11 || !validXY(parts[1]) || !validSubmoduleField(parts[2]) || !validModes(parts[3:7]) || !validObjectIDs(parts[7:10]) || len(parts[10]) == 0 {
			return porcelainRecord{}, ErrGitObservation
		}
		return newPorcelainRecord(parts[:10], parts[10], parts[2], parts[6]), nil
	case bytes.HasPrefix(raw, []byte("? ")):
		if len(raw) == 2 {
			return porcelainRecord{}, ErrGitObservation
		}
		return porcelainRecord{kind: "?", fields: []string{"?"}, path: string(raw[2:])}, nil
	default:
		return porcelainRecord{}, ErrGitObservation
	}
}

func newPorcelainRecord(fields [][]byte, path, submodule, worktreeMode []byte) porcelainRecord {
	values := make([]string, len(fields))
	for i := range fields {
		values[i] = string(fields[i])
	}
	return porcelainRecord{kind: values[0], fields: values, path: string(path), submodule: string(submodule), worktreeMode: string(worktreeMode)}
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
	return bytes.Equal(value, []byte("N...")) || len(value) == 4 && value[0] == 'S' && (value[1] == '.' || value[1] == 'C') && (value[2] == '.' || value[2] == 'M') && (value[3] == '.' || value[3] == 'U')
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
	a, b := canonicalStatusKeys(first), canonicalStatusKeys(second)
	if len(a) != len(b) {
		return ErrInconsistentWorktree
	}
	for i := range a {
		if !bytes.Equal(a[i], b[i]) {
			return ErrInconsistentWorktree
		}
	}
	return nil
}
func canonicalStatusKeys(records []porcelainRecord) [][]byte {
	keys := make([][]byte, len(records))
	for i, record := range records {
		keys[i] = record.canonicalKey()
	}
	sort.Slice(keys, func(i, j int) bool { return bytes.Compare(keys[i], keys[j]) < 0 })
	return keys
}
func ensureNoDirtySubmodules(records []porcelainRecord) error {
	for _, record := range records {
		if record.dirtySubmodule() {
			return ErrDirtySubmodule
		}
	}
	return nil
}

func observedChangedPaths(records []porcelainRecord) []string {
	seen := map[string]bool{}
	paths := []string{}
	for _, record := range records {
		if record.path != "" && !seen[record.path] {
			seen[record.path] = true
			paths = append(paths, record.path)
		}
	}
	sort.Strings(paths)
	return paths
}

func recordStatusKind(record porcelainRecord) string {
	if record.kind == "?" {
		return "A"
	}
	if len(record.fields) > 1 {
		if strings.Contains(record.fields[1], "A") {
			return "A"
		}
		if strings.Contains(record.fields[1], "D") {
			return "D"
		}
	}
	if record.contentMissing() {
		return "D"
	}
	if len(record.fields) > 1 && strings.Contains(record.fields[1], "T") {
		return "T"
	}
	return "M"
}

func parseNameStatus(output []byte) ([]string, map[string]string, error) {
	if len(output) == 0 {
		return nil, map[string]string{}, nil
	}
	if output[len(output)-1] != 0 {
		return nil, nil, ErrGitObservation
	}
	parts := bytes.Split(output[:len(output)-1], []byte{0})
	if len(parts)%2 != 0 {
		return nil, nil, ErrGitObservation
	}
	kinds := map[string]string{}
	paths := make([]string, 0, len(parts)/2)
	for i := 0; i < len(parts); i += 2 {
		status, path := string(parts[i]), string(parts[i+1])
		if len(status) != 1 || !strings.Contains("AMDTU", status) || path == "" || kinds[path] != "" {
			return nil, nil, ErrGitObservation
		}
		kinds[path] = status
		paths = append(paths, path)
		if len(paths) > domain.MaxFingerprintPaths {
			return nil, nil, ErrFingerprintPathLimit
		}
	}
	sort.Strings(paths)
	return paths, kinds, nil
}

func mergeChangeKind(left, right string) string {
	if left == "" {
		return right
	}
	if left == "T" || right == "T" {
		return "T"
	}
	if left == "A" || right == "A" {
		return "A"
	}
	if left == "D" && right == "D" {
		return "D"
	}
	return "M"
}

type repositoryLayerState struct{ mode, object string }

func parseIndexEntry(output []byte, path string) (repositoryLayerState, error) {
	if len(output) == 0 {
		return repositoryLayerState{mode: "000000", object: "missing"}, nil
	}
	if output[len(output)-1] != 0 {
		return repositoryLayerState{}, ErrGitObservation
	}
	records := bytes.Split(output[:len(output)-1], []byte{0})
	if len(records) != 1 {
		return repositoryLayerState{}, ErrInconsistentWorktree
	}
	header, gotPath, ok := bytes.Cut(records[0], []byte{'\t'})
	fields := bytes.Fields(header)
	if !ok || string(gotPath) != path || len(fields) != 3 || len(fields[0]) != 6 || !validGitObjectID(string(fields[1])) || string(fields[2]) != "0" {
		return repositoryLayerState{}, ErrGitObservation
	}
	return repositoryLayerState{mode: string(fields[0]), object: string(fields[1])}, nil
}

func parseBaseEntry(output []byte, path string) (repositoryLayerState, error) {
	if len(output) == 0 {
		return repositoryLayerState{mode: "000000", object: "missing"}, nil
	}
	if output[len(output)-1] != 0 {
		return repositoryLayerState{}, ErrGitObservation
	}
	records := bytes.Split(output[:len(output)-1], []byte{0})
	if len(records) != 1 {
		return repositoryLayerState{}, ErrGitObservation
	}
	header, gotPath, ok := bytes.Cut(records[0], []byte{'\t'})
	fields := bytes.Fields(header)
	if !ok || string(gotPath) != path || len(fields) != 3 || len(fields[0]) != 6 || !validGitObjectID(string(fields[2])) {
		return repositoryLayerState{}, ErrGitObservation
	}
	return repositoryLayerState{mode: string(fields[0]), object: string(fields[2])}, nil
}

func layerDigest(layer string, state repositoryLayerState) domain.Digest {
	_ = layer
	return digestFields(pathContentDigestDomain+"/layer", []byte(state.mode), []byte(state.object))
}

func (o *GitObserver) entries(ctx context.Context, root, baseCommit string, paths []string, kinds map[string]string) ([]domain.RepositoryChangedEntry, error) {
	unique := map[string]bool{}
	sorted := make([]string, 0, len(paths))
	for _, path := range paths {
		if !unique[path] {
			if _, err := resolveStatusPath(root, path); err != nil {
				return nil, err
			}
			unique[path] = true
			sorted = append(sorted, path)
		}
	}
	sort.Strings(sorted)
	entries := make([]domain.RepositoryChangedEntry, 0, len(sorted))
	for _, path := range sorted {
		kind := kinds[path]
		change := domain.RepositoryChangeModified
		switch kind {
		case "A":
			change = domain.RepositoryChangeAdded
		case "D":
			change = domain.RepositoryChangeDeleted
		case "T":
			change = domain.RepositoryChangeTypeMode
		}
		baseResult, err := o.runner.run(ctx, gitShowBaseEntry, root, baseCommit+"\x00"+path)
		if err != nil || baseResult.exitCode != 0 {
			return nil, ErrInconsistentWorktree
		}
		baseState, err := parseBaseEntry(baseResult.stdout, path)
		if err != nil {
			return nil, err
		}
		indexResult, err := o.runner.run(ctx, gitShowIndexEntry, root, path)
		if err != nil || indexResult.exitCode != 0 {
			return nil, ErrInconsistentWorktree
		}
		indexState, err := parseIndexEntry(indexResult.stdout, path)
		if err != nil {
			return nil, err
		}
		worktreeState := repositoryLayerState{mode: "000000", object: "missing"}
		local, _ := resolveStatusPath(root, path)
		info, statErr := os.Lstat(local)
		if statErr == nil {
			switch {
			case info.Mode().IsRegular():
				worktreeState.mode = "100644"
				if info.Mode()&0o111 != 0 {
					worktreeState.mode = "100755"
				}
			case info.Mode()&os.ModeSymlink != 0:
				worktreeState.mode = "120000"
				target, readErr := os.Readlink(local)
				if readErr != nil {
					return nil, ErrInconsistentWorktree
				}
				result, hashErr := o.runner.runWithInput(ctx, gitHashObjectStdin, root, "", []byte(target))
				if hashErr != nil || result.exitCode != 0 {
					return nil, ErrInconsistentWorktree
				}
				object, parseErr := parseObjectLine(result.stdout)
				if parseErr != nil {
					return nil, parseErr
				}
				worktreeState.object = object
			case info.IsDir():
				if indexState.mode != "160000" {
					return nil, ErrInconsistentWorktree
				}
				worktreeState.mode, worktreeState.object = "160000", indexState.object
			default:
				return nil, ErrInconsistentWorktree
			}
			if worktreeState.mode != "160000" && worktreeState.mode != "120000" {
				result, err := o.runner.run(ctx, gitHashObject, root, path)
				if err != nil || result.exitCode != 0 {
					return nil, ErrInconsistentWorktree
				}
				object, parseErr := parseObjectLine(result.stdout)
				if parseErr != nil {
					return nil, parseErr
				}
				worktreeState.object = object
			}
		} else if !errors.Is(statErr, os.ErrNotExist) {
			return nil, ErrInconsistentWorktree
		}
		baseDigest := layerDigest("base", baseState)
		indexDigest := layerDigest("index", indexState)
		worktreeDigest := layerDigest("worktree", worktreeState)
		contentDigest := normalizedPathContentDigest(baseDigest, indexDigest, worktreeDigest)
		mode := normalizedPathMode(baseState, indexState, worktreeState)
		entries = append(entries, domain.RepositoryChangedEntry{Path: path, ChangeType: change, FileMode: mode, Gitlink: mode == "160000", BaseMode: baseState.mode, BaseContentDigest: baseDigest, IndexMode: indexState.mode, IndexContentDigest: indexDigest, WorktreeMode: worktreeState.mode, WorktreeContentDigest: worktreeDigest, ContentDigest: contentDigest})
	}
	return entries, nil
}

func normalizedPathContentDigest(base, index, worktree domain.Digest) domain.Digest {
	if index == base {
		return worktree
	}
	if worktree == index {
		return index
	}
	return digestFields(pathContentDigestDomain+"/split", []byte(index), []byte(worktree))
}

func normalizedPathMode(base, index, worktree repositoryLayerState) string {
	baseDigest, indexDigest, worktreeDigest := layerDigest("base", base), layerDigest("index", index), layerDigest("worktree", worktree)
	if indexDigest == baseDigest {
		return worktree.mode
	}
	if worktreeDigest == indexDigest {
		return index.mode
	}
	return worktree.mode
}

func digestGitDirectory(path, fileIdentity, domainName string) domain.Digest {
	return digestFields(domainName, []byte(path), []byte(fileIdentity))
}
func digestWorktreeGitDirectory(path, fileIdentity string) domain.Digest {
	return digestFields(worktreeGitDirectoryDigestDomain, []byte(path), []byte(fileIdentity))
}
func digestWorktreeInstance(root, common, commonIdentity, gitDir, gitDirectoryIdentity string) domain.Digest {
	return digestFields(worktreeInstanceDigestDomain, []byte(root), []byte(common), []byte(commonIdentity), []byte(gitDir), []byte(gitDirectoryIdentity))
}
func digestWorkspaceIdentity(origin domain.WorkspaceOrigin, instance domain.Digest) domain.Digest {
	return digestFields(workspaceIdentityDigestDomain, []byte(instance), []byte(origin.TaskBranch), []byte(origin.BaseCommit))
}
func digestHistory(previous domain.Digest, previousHead, head string, relation domain.RepositoryHistoryRelation) domain.Digest {
	return digestFields(workspaceHistoryDigestDomain, []byte(previous), []byte(previousHead), []byte(head), []byte(relation))
}

func digestWorkspaceContent(baseCommit string, surface []domain.RepositoryChangedEntry) domain.Digest {
	digest := sha256.New()
	writeDigestField(digest, []byte(workspaceContentDigestDomain))
	writeDigestField(digest, []byte(baseCommit))
	for _, entry := range surface {
		writeDigestField(digest, []byte(entry.Path))
		writeDigestField(digest, []byte(entry.FileMode))
		writeDigestField(digest, []byte(entry.ContentDigest))
	}
	return domain.Digest(hex.EncodeToString(digest.Sum(nil)))
}

func digestRepositoryBinding(binding domain.RepositoryBinding) domain.Digest {
	digest := sha256.New()
	writeDigestField(digest, []byte(repositoryBindingDomain))
	for _, value := range []string{string(binding.WorktreeInstanceDigest), string(binding.IdentityDigest), string(binding.HistoryDigest), string(binding.ContentDigest), binding.CurrentHead, binding.HeadTree} {
		writeDigestField(digest, []byte(value))
	}
	if binding.BaseCommitAncestor {
		writeDigestField(digest, []byte{1})
	} else {
		writeDigestField(digest, []byte{0})
	}
	if binding.CurrentBranch == nil {
		writeDigestField(digest, nil)
	} else {
		writeDigestField(digest, []byte(*binding.CurrentBranch))
	}
	for _, set := range [][]domain.RepositoryChangedEntry{binding.ChangedEntries, binding.TaskSurface} {
		for _, entry := range set {
			writeDigestField(digest, []byte(entry.Path))
			writeDigestField(digest, []byte(entry.ChangeType))
			writeDigestField(digest, []byte(entry.FileMode))
			writeDigestField(digest, []byte(entry.ContentDigest))
		}
	}
	return domain.Digest(hex.EncodeToString(digest.Sum(nil)))
}

func VerifyBindingDigests(binding domain.RepositoryBinding) error {
	if binding.Validate() != nil || binding.BindingDigest != digestRepositoryBinding(binding) {
		return ErrInvalidBindingDigests
	}
	return nil
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

// keep filepath imported in this platform package so mode/path semantics remain here.
var _ = filepath.Separator
