package recovery

import "github.com/Innocent-children/dev-flow/internal/domain"

func CompareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, error) {
	if authoritative.Validate() != nil || fresh.Validate() != nil {
		return "", domain.ErrInvalidArgument
	}
	identity := authoritative.CanonicalRoot == fresh.CanonicalRoot && authoritative.GitCommonDirDigest == fresh.GitCommonDirDigest && authoritative.RepositoryIdentity == fresh.RepositoryIdentity && sameText(authoritative.Branch, fresh.Branch) && authoritative.Detached == fresh.Detached && sameText(authoritative.Head, fresh.Head) && authoritative.Unborn == fresh.Unborn
	if identity && authoritative.WorktreeFingerprint == fresh.WorktreeFingerprint && authoritative.BindingDigest == fresh.BindingDigest {
		return RepositoryExact, nil
	}
	if identity && authoritative.WorktreeFingerprint != fresh.WorktreeFingerprint && authoritative.BindingDigest != fresh.BindingDigest {
		return RepositoryWorktreeOnlyChanged, nil
	}
	return RepositoryForbiddenChange, nil
}
func BindingAcceptedForAction(action domain.ActionKind, relation RepositoryRelation) (bool, error) {
	if !action.IsValidV2() || !relation.IsValid() {
		return false, domain.ErrInvalidArgument
	}
	switch action {
	case domain.ActionCompleteImplementation, domain.ActionCompleteRefactor:
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged, nil
	default:
		return relation == RepositoryExact, nil
	}
}
func sameText(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
