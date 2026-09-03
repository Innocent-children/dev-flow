package domain

import (
	"sort"
	"strings"
	"time"
)

// FileScopeDecision records the developer's choice for one prepared write.
type FileScopeDecision string

const (
	FileScopePending     FileScopeDecision = "pending"
	FileScopeAllowOnce   FileScopeDecision = "allow_once"
	FileScopeExpandScope FileScopeDecision = "expand_scope"
	FileScopeReject      FileScopeDecision = "reject"
)

func (d FileScopeDecision) IsValid() bool {
	return d == FileScopePending || d == FileScopeAllowOnce || d == FileScopeExpandScope || d == FileScopeReject
}

func (d FileScopeDecision) IsDeveloperChoice() bool {
	return d == FileScopeAllowOnce || d == FileScopeExpandScope || d == FileScopeReject
}

// FileScopeApplicability makes the duration of one decision explicit.
type FileScopeApplicability string

const (
	FileScopePendingWrite     FileScopeApplicability = "pending_write"
	FileScopeExactWrite       FileScopeApplicability = "exact_write"
	FileScopeTaskPlanRevision FileScopeApplicability = "task_plan_revision"
	FileScopeTaskPlanUpdate   FileScopeApplicability = "task_plan_update"
)

func (a FileScopeApplicability) IsValid() bool {
	return a == FileScopePendingWrite || a == FileScopeExactWrite ||
		a == FileScopeTaskPlanRevision || a == FileScopeTaskPlanUpdate
}

// FileScopeRecord keeps one prepared write and the developer decision that followed it.
type FileScopeRecord struct {
	RequestID          ID                     `json:"request_id"`
	Paths              []string               `json:"paths"`
	IntentDigest       Digest                 `json:"intent_digest"`
	TaskPlanRevision   uint32                 `json:"task_plan_revision"`
	SourceNode         NodeID                 `json:"source_node"`
	SourceActionID     ID                     `json:"source_action_id"`
	Decision           FileScopeDecision      `json:"decision"`
	Reason             string                 `json:"reason"`
	Applicability      FileScopeApplicability `json:"applicability"`
	AllowedActionID    *ID                    `json:"allowed_action_id,omitempty"`
	Consumed           bool                   `json:"consumed"`
	Observed           bool                   `json:"observed"`
	AcceptedPathStates []FileScopePathState   `json:"accepted_path_states"`
	CreatedAt          time.Time              `json:"created_at"`
	DecidedAt          *time.Time             `json:"decided_at,omitempty"`
}

func (r FileScopeRecord) Validate() error {
	if !r.RequestID.IsValid() || len(r.Paths) == 0 || len(r.Paths) > MaxFileScopePaths ||
		!r.IntentDigest.IsValid() || r.TaskPlanRevision == 0 ||
		(r.SourceNode != NodeImplement && r.SourceNode != NodeRefactor) ||
		!r.SourceActionID.IsValid() || !r.Decision.IsValid() || !r.Applicability.IsValid() ||
		validateUTC(r.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	for index, path := range r.Paths {
		if ValidateRepositoryContractPath(path) != nil || index > 0 && r.Paths[index-1] >= path {
			return ErrInvalidArgument
		}
	}
	switch r.Decision {
	case FileScopePending:
		if r.Reason != "" || r.Applicability != FileScopePendingWrite || r.AllowedActionID != nil || r.Consumed || len(r.AcceptedPathStates) != 0 || r.DecidedAt != nil {
			return ErrInvalidArgument
		}
	case FileScopeAllowOnce:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeExactWrite ||
			r.AllowedActionID == nil || !r.AllowedActionID.IsValid() || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
		if r.Observed && !r.Consumed {
			return ErrInvalidArgument
		}
		if r.Consumed {
			if len(r.AcceptedPathStates) != len(r.Paths) {
				return ErrInvalidArgument
			}
			for index, state := range r.AcceptedPathStates {
				if state.Validate() != nil || state.Path != r.Paths[index] {
					return ErrInvalidArgument
				}
			}
		} else if len(r.AcceptedPathStates) != 0 {
			return ErrInvalidArgument
		}
	case FileScopeExpandScope:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeTaskPlanUpdate ||
			r.AllowedActionID != nil || r.Consumed || len(r.AcceptedPathStates) != 0 || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
	case FileScopeReject:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeTaskPlanRevision ||
			r.AllowedActionID != nil || r.Consumed || len(r.AcceptedPathStates) != 0 || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

// FileScopePathState is the Core-observed effective state accepted by one
// consumed allow_once decision. Layer-only index/worktree movement does not
// change this state.
type FileScopePathState struct {
	Path          string `json:"path"`
	Present       bool   `json:"present"`
	FileMode      string `json:"file_mode"`
	ContentDigest Digest `json:"content_digest"`
}

func (s FileScopePathState) Validate() error {
	if ValidateRepositoryContractPath(s.Path) != nil {
		return ErrInvalidArgument
	}
	if !s.Present {
		if s.FileMode != "" || s.ContentDigest != "" {
			return ErrInvalidArgument
		}
		return nil
	}
	if requireNormalizedText(s.FileMode, MaxIdentifierBytes, true) != nil || !s.ContentDigest.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type FileScopeDecisionInput struct {
	Choice FileScopeDecision `json:"choice"`
	Reason string            `json:"reason"`
}

func (d FileScopeDecisionInput) Validate() error {
	if !d.Choice.IsDeveloperChoice() || requireNormalizedText(d.Reason, MaxReasonBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (t ProcessTask) PathExpectedByCurrentPlan(path string) bool {
	if t.TaskPlan == nil {
		return false
	}
	for _, item := range t.TaskPlan.WorkItems {
		for _, expected := range item.ExpectedPaths {
			if expected == path {
				return true
			}
			if strings.HasSuffix(expected, "/**") {
				prefix := strings.TrimSuffix(expected, "/**")
				if prefix != "" && strings.HasPrefix(path, prefix+"/") {
					return true
				}
			}
		}
	}
	return false
}

func (t ProcessTask) PathRetainedAsProcessArtifact(path string) bool {
	for _, artifacts := range [][]ArtifactReference{
		artifactReferences(t.Requirements),
		designArtifactReferences(t.Design),
		taskPlanArtifactReferences(t.TaskPlan),
	} {
		for _, artifact := range artifacts {
			if artifact.Path == path {
				return true
			}
		}
	}
	return false
}

func (t ProcessTask) UnexplainedChangedPaths(primary RepositoryBinding, additional []RepositoryScopeEntry) []string {
	paths := RepositoryScopeTaskSurfacePaths(t.EffectivePrimaryRepositoryKey(), primary, additional)
	observed := t
	observed.Repository = primary
	observed.AdditionalRepositories = additional
	authorized := map[string]bool{}
	for _, record := range t.FileScopeRecords {
		if record.Decision != FileScopeAllowOnce || t.TaskPlan == nil || record.TaskPlanRevision != t.TaskPlan.Revision {
			continue
		}
		if record.Consumed {
			currentStates, err := observed.FileScopePathStates(record.Paths)
			if err != nil {
				continue
			}
			for index, accepted := range record.AcceptedPathStates {
				if accepted == currentStates[index] && currentStates[index].Present {
					authorized[accepted.Path] = true
				}
			}
			continue
		}
		if t.CurrentAction != nil && record.AllowedActionID != nil && *record.AllowedActionID == t.CurrentAction.ActionID && containsFileScopePaths(paths, record.Paths) {
			for _, path := range record.Paths {
				authorized[path] = true
			}
		}
	}
	unexplained := []string{}
	for _, path := range paths {
		if !t.PathExpectedByCurrentPlan(path) && !t.PathRetainedAsProcessArtifact(path) && !authorized[path] {
			unexplained = append(unexplained, path)
		}
	}
	return unexplained
}

func (t ProcessTask) FileScopePathStates(paths []string) ([]FileScopePathState, error) {
	states := make([]FileScopePathState, len(paths))
	for index, scopedPath := range paths {
		if t.ValidateRepositoryPath(scopedPath) != nil || index > 0 && paths[index-1] >= scopedPath {
			return nil, ErrInvalidArgument
		}
		binding, repositoryPath, ok := t.repositoryBindingForContractPath(scopedPath)
		if !ok {
			return nil, ErrInvalidArgument
		}
		state := FileScopePathState{Path: scopedPath}
		entryIndex := sort.Search(len(binding.TaskSurface), func(candidate int) bool {
			return binding.TaskSurface[candidate].Path >= repositoryPath
		})
		if entryIndex < len(binding.TaskSurface) && binding.TaskSurface[entryIndex].Path == repositoryPath {
			entry := binding.TaskSurface[entryIndex]
			state.Present = true
			state.FileMode = entry.FileMode
			state.ContentDigest = entry.ContentDigest
		}
		states[index] = state
	}
	return states, nil
}

func (t ProcessTask) repositoryBindingForContractPath(scopedPath string) (RepositoryBinding, string, bool) {
	if len(t.AdditionalRepositories) == 0 {
		return t.Repository, scopedPath, true
	}
	keyText, repositoryPath, ok := strings.Cut(scopedPath, repositoryPathSeparator)
	if !ok {
		return RepositoryBinding{}, "", false
	}
	key := RepositoryKey(keyText)
	if key == t.EffectivePrimaryRepositoryKey() {
		return t.Repository, repositoryPath, true
	}
	for _, repository := range t.AdditionalRepositories {
		if repository.Key == key {
			return repository.Binding, repositoryPath, true
		}
	}
	return RepositoryBinding{}, "", false
}

func containsFileScopePaths(values, wanted []string) bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	for _, value := range wanted {
		if !set[value] {
			return false
		}
	}
	return true
}
