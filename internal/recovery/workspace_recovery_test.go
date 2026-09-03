package recovery

import (
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestRepositoryComparisonSeparatesContentHistoryAndInstance(t *testing.T) {
	base := recoveryBinding('a')
	if relation, err := CompareRepositoryBindings(base, base); err != nil || relation != RepositoryExact {
		t.Fatalf("exact=%s err=%v", relation, err)
	}
	content := base.Clone()
	content.ContentDigest = recoveryDigest('b')
	content.BindingDigest = recoveryDigest('c')
	if relation, err := CompareRepositoryBindings(base, content); err != nil || relation != RepositoryWorktreeOnlyChanged {
		t.Fatalf("content=%s err=%v", relation, err)
	}
	history := base.Clone()
	history.HistoryRelation = domain.RepositoryHistoryRewrite
	history.HistoryDigest = recoveryDigest('d')
	history.BindingDigest = recoveryDigest('e')
	if relation, err := CompareRepositoryBindings(base, history); err != nil || relation != RepositoryForbiddenChange {
		t.Fatalf("history=%s err=%v", relation, err)
	}
	replaced := base.Clone()
	replaced.WorktreeInstanceDigest = recoveryDigest('f')
	replaced.IdentityDigest = recoveryDigest('1')
	replaced.BindingDigest = recoveryDigest('2')
	if relation, err := CompareRepositoryBindings(base, replaced); err != nil || relation != RepositoryForbiddenChange {
		t.Fatalf("instance=%s err=%v", relation, err)
	}
}

func TestRepositoryScopeDeltaUsesEntryContentNotHistoricalUnion(t *testing.T) {
	base := recoveryBinding('a')
	task := domain.ProcessTask{WorkspaceOrigin: recoveryOrigin('a'), Repository: base}
	changed := base.Clone()
	changed.TaskSurface = []domain.RepositoryChangedEntry{recoveryEntry("src/main.go", 'b')}
	changed.ContentDigest, changed.BindingDigest = recoveryDigest('b'), recoveryDigest('c')
	paths := RepositoryScopeDeltaPaths(task, RepositoryScopeObservation{Primary: changed})
	if len(paths) != 1 || paths[0] != "src/main.go" {
		t.Fatalf("paths=%v", paths)
	}
	reverted := changed.Clone()
	reverted.TaskSurface = nil
	reverted.ContentDigest, reverted.BindingDigest = base.ContentDigest, base.BindingDigest
	task.Repository = changed
	paths = RepositoryScopeDeltaPaths(task, RepositoryScopeObservation{Primary: reverted})
	if len(paths) != 1 || paths[0] != "src/main.go" {
		t.Fatalf("revert delta=%v", paths)
	}
}

func recoveryBinding(seed byte) domain.RepositoryBinding {
	digest := recoveryDigest(seed)
	branch := "feature/task"
	head := strings.Repeat("a", 40)
	return domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: time.Date(2026, 9, 3, 0, 0, 0, 0, time.UTC), BindingDigest: digest}
}
func recoveryOrigin(seed byte) domain.WorkspaceOrigin {
	digest := recoveryDigest(seed)
	return domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: strings.Repeat("a", 40), TaskBranch: "feature/task", SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: "/tmp/task", WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
}
func recoveryEntry(path string, seed byte) domain.RepositoryChangedEntry {
	digest := recoveryDigest(seed)
	return domain.RepositoryChangedEntry{Path: path, ChangeType: domain.RepositoryChangeModified, FileMode: "100644", IndexMode: "100644", IndexContentDigest: digest, WorktreeMode: "100644", WorktreeContentDigest: digest, ContentDigest: digest}
}
func recoveryDigest(seed byte) domain.Digest { return domain.Digest(strings.Repeat(string(seed), 64)) }
