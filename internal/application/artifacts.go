package application

import (
	"context"
	"strconv"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// ArtifactCollection is a temporary, read-only view of the current Action delta.
// Core supplies file facts; the Host supplies only Slot and Summary.
type ArtifactCollection struct {
	TaskID            domain.ID           `json:"task_id"`
	ActionID          domain.ID           `json:"action_id"`
	Revision          uint64              `json:"revision"`
	ObservationDigest domain.Digest       `json:"observation_digest"`
	Files             []CollectedArtifact `json:"files"`
}

type CollectedArtifact struct {
	Path       string        `json:"path"`
	ChangeType string        `json:"change_type"`
	Digest     domain.Digest `json:"digest"`
	Slot       string        `json:"slot"`
	Summary    string        `json:"summary"`
}

type CollectArtifactsRequest struct {
	Host     domain.Host `json:"host"`
	TaskID   domain.ID   `json:"task_id"`
	ActionID domain.ID   `json:"action_id"`
}

type PrepareArtifactsRequest struct {
	Host       domain.Host        `json:"host"`
	Collection ArtifactCollection `json:"collection"`
}

type PreparedArtifacts struct {
	Current      *[]ArtifactSubmission `json:"current,omitempty"`
	OtherProcess []ArtifactSubmission  `json:"other_process"`
}

func (s *Service) CollectArtifacts(ctx context.Context, r CollectArtifactsRequest) (ArtifactCollection, error) {
	_, collection, err := s.collectArtifacts(ctx, r)
	return collection, err
}

func (s *Service) collectArtifacts(ctx context.Context, r CollectArtifactsRequest) (domain.ProcessTask, ArtifactCollection, error) {
	if !s.valid() || ctx == nil || !r.Host.IsValid() || !r.TaskID.IsValid() || !r.ActionID.IsValid() {
		return domain.ProcessTask{}, ArtifactCollection{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return task, ArtifactCollection{}, err
	}
	if task.CurrentNode.Terminal() {
		return task, ArtifactCollection{}, domain.ErrTaskTerminal
	}
	if task.CurrentNode == domain.NodeBlocked {
		return task, ArtifactCollection{}, domain.ErrTaskBlocked
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != r.ActionID {
		return task, ArtifactCollection{}, domain.ErrActionStale
	}
	if pending, err := s.hasPendingActionOperation(ctx, task); err != nil {
		return task, ArtifactCollection{}, err
	} else if pending {
		return task, ArtifactCollection{}, domain.ErrRecoveryUnavailable
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return task, ArtifactCollection{}, err
	}
	if scopeHasUnavailableWorkspace(task, fresh) {
		return task, ArtifactCollection{}, domain.ErrWorkspaceUnavailable
	}
	if scopeHasHistoryConflict(fresh) {
		return task, ArtifactCollection{}, domain.ErrWorkspaceHistoryConflict
	}
	if implementationContentMustRemainCurrent(task.CurrentNode) && contentDiffersFromCurrentAuthority(task, fresh) {
		return task, ArtifactCollection{}, domain.ErrRepositoryDrift
	}
	workspace, err := scopeWorkspaceDigests(task, fresh)
	if err != nil {
		return task, ArtifactCollection{}, domain.ErrInternal
	}
	collection := ArtifactCollection{TaskID: task.TaskID, ActionID: r.ActionID, Revision: task.Revision, Files: []CollectedArtifact{}}
	entries := map[string]CollectedArtifact{}
	add := func(prefix string, previous, observed domain.RepositoryBinding) {
		for _, entry := range previous.TaskSurface {
			// A path absent from the new surface has returned to its base state.
			entries[prefix+entry.Path] = CollectedArtifact{Path: prefix + entry.Path, ChangeType: "restored", Digest: entry.BaseContentDigest}
		}
		for _, entry := range observed.TaskSurface {
			entries[prefix+entry.Path] = CollectedArtifact{Path: prefix + entry.Path, ChangeType: string(entry.ChangeType), Digest: entry.ContentDigest}
		}
	}
	prefix := ""
	if len(task.AdditionalRepositories) != 0 {
		prefix = string(task.EffectivePrimaryRepositoryKey()) + "::"
	}
	add(prefix, task.Repository, fresh.Primary)
	for i, entry := range task.AdditionalRepositories {
		add(string(entry.Key)+"::", entry.Binding, fresh.Additional[i].Binding)
	}
	for _, path := range recovery.RepositoryScopeDeltaPaths(task, fresh) {
		entry, ok := entries[path]
		if !ok || task.ValidateRepositoryPath(path) != nil || !entry.Digest.IsValid() {
			return task, ArtifactCollection{}, domain.ErrInternal
		}
		collection.Files = append(collection.Files, entry)
	}
	collection.ObservationDigest, err = digestCanonical(struct {
		TaskID    domain.ID
		ActionID  domain.ID
		Revision  uint64
		Workspace domain.WorkspaceDigests
	}{task.TaskID, r.ActionID, task.Revision, workspace})
	if err != nil {
		return task, ArtifactCollection{}, domain.ErrInternal
	}
	return task, collection, nil
}

// PrepareArtifacts reobserves Git and assembles artifact slots from the complete
// classified collection. It leaves Task, Action, operations and Git unchanged.
func (s *Service) PrepareArtifacts(ctx context.Context, r PrepareArtifactsRequest) (PreparedArtifacts, error) {
	task, fresh, err := s.collectArtifacts(ctx, CollectArtifactsRequest{Host: r.Host, TaskID: r.Collection.TaskID, ActionID: r.Collection.ActionID})
	if err != nil {
		return PreparedArtifacts{}, err
	}
	if r.Collection.Revision != fresh.Revision {
		return PreparedArtifacts{}, domain.ErrActionStale
	}
	if r.Collection.ObservationDigest != fresh.ObservationDigest {
		return PreparedArtifacts{}, domain.ErrWorkspaceObservationUnstable
	}
	input := map[string]CollectedArtifact{}
	indexes := map[string]int{}
	for index, entry := range r.Collection.Files {
		if _, found := input[entry.Path]; found {
			return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation("collection.files", domain.RuleStringListDuplicate))
		}
		input[entry.Path] = entry
		indexes[entry.Path] = index
	}
	if len(input) != len(fresh.Files) {
		return PreparedArtifacts{}, collectionCoverageError(fresh, input)
	}
	_, primaryAllowed := workflow.PrimaryArtifactRoleForNode(task.CurrentNode)
	current := []ArtifactSubmission{}
	out := PreparedArtifacts{OtherProcess: []ArtifactSubmission{}}
	if primaryAllowed {
		out.Current = &current
	}
	for _, fact := range fresh.Files {
		entry, found := input[fact.Path]
		if !found {
			return PreparedArtifacts{}, collectionCoverageError(fresh, input)
		}
		if entry.Digest != fact.Digest || entry.ChangeType != fact.ChangeType {
			return PreparedArtifacts{}, domain.ErrWorkspaceObservationUnstable
		}
		path := "collection.files[" + strconv.Itoa(indexes[fact.Path]) + "]"
		item := ArtifactSubmission{Path: fact.Path, Digest: fact.Digest, Summary: entry.Summary}
		switch entry.Slot {
		case "current":
			if !primaryAllowed {
				return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation(path+".slot", domain.RuleArtifactRoleNotAllowed))
			}
			current = append(current, item)
		case "other_process":
			out.OtherProcess = append(out.OtherProcess, item)
		case "product":
			if task.CurrentNode != domain.NodeImplement && task.CurrentNode != domain.NodeRefactor {
				return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation(path+".slot", domain.RuleArtifactRoleNotAllowed))
			}
		default:
			return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation(path+".slot", domain.RuleRequiredMemberMissing))
		}
		if (domain.ArtifactReference{Role: domain.ArtifactOtherProcess, Path: fact.Path, Digest: fact.Digest, Summary: entry.Summary}).Validate() != nil {
			return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation(path+".summary", domain.RuleTextNotNormalized))
		}
	}
	if len(current)+len(out.OtherProcess) > domain.MaxArtifactReferencesPerAction {
		return PreparedArtifacts{}, domain.InvalidArgumentViolations(domain.Violation("collection.files", domain.RuleStringListTooLong))
	}
	return out, nil
}

func collectionCoverageError(fresh ArtifactCollection, input map[string]CollectedArtifact) error {
	err := domain.InvalidArgumentViolations(domain.Violation("collection.files", domain.RuleCurrentSetRequired))
	for _, file := range fresh.Files {
		if _, found := input[file.Path]; !found {
			err.RepositoryPaths = append(err.RepositoryPaths, file.Path)
		}
	}
	return err
}

func artifactManifestError(task domain.ProcessTask, missing []string) error {
	violations := []domain.ContractViolation{domain.Violation("artifacts.other_process", domain.RuleArtifactManifestIncomplete)}
	if _, allowed := workflow.PrimaryArtifactRoleForNode(task.CurrentNode); allowed {
		violations = append(violations, domain.Violation("artifacts.current", domain.RuleArtifactManifestIncomplete))
	}
	err := domain.InvalidArgumentViolations(violations...)
	err.RepositoryPaths = append([]string(nil), missing...)
	return err
}
