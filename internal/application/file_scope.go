package application

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

var supportedFileChangeTools = map[domain.Host]map[string]bool{
	domain.HostCodex:    {"apply_patch": true},
	domain.HostDeepSeek: {"write": true, "edit": true, "str_replace_editor": true},
}

// PrepareFileChange is the shared Core entry used by Host write gates. It
// checks one prepared structured write and creates a persisted blocker before
// the Host tool runs when any target is outside the current Task Plan.
func (s *Service) PrepareFileChange(ctx context.Context, request PrepareFileChangeRequest) (PrepareFileChangeResult, error) {
	if !s.valid() || ctx == nil || !request.Host.IsValid() || !supportedFileChangeTools[request.Host][request.ToolName] ||
		!validRepositoryPathInput(request.RepositoryPath) || !request.IntentDigest.IsValid() {
		return PrepareFileChangeResult{}, domain.ErrInvalidArgument
	}
	root := filepath.Clean(request.RepositoryPath)
	if absolute, absoluteErr := filepath.Abs(root); absoluteErr == nil {
		root = absolute
	}
	instance := domain.Digest("")
	identifyErr := error(nil)
	if identifier, ok := s.repositoryObserver.(repository.WorktreeIdentifier); ok {
		root, instance, identifyErr = identifier.IdentifyWorkspace(ctx, request.RepositoryPath)
	} else {
		binding, observeErr := s.repositoryObserver.Observe(ctx, request.RepositoryPath)
		if observeErr != nil {
			identifyErr = observeErr
		} else {
			instance = binding.WorktreeInstanceDigest
		}
	}

	var task domain.ProcessTask
	var err error
	if instance.IsValid() {
		task, err = s.taskStore.LoadActiveTask(ctx, instance)
	} else {
		err = store.ErrTaskNotFound
	}
	if errors.Is(err, store.ErrTaskNotFound) {
		if lookup, ok := s.taskStore.(store.WorkspaceLookupStore); ok {
			task, err = lookup.LoadActiveTaskByCanonicalRoot(ctx, root)
		}
	}
	if errors.Is(err, store.ErrTaskNotFound) {
		return PrepareFileChangeResult{Decision: FileChangeAllow}, nil
	}
	if err != nil {
		return PrepareFileChangeResult{}, mapStoreError(err)
	}
	if identifyErr != nil || !taskContainsWorkspaceInstance(task, root, instance) {
		return PrepareFileChangeResult{}, domain.ErrWorkspaceUnavailable
	}
	if task.OriginHost != request.Host {
		return denyFileChange(task, nil, "The active Dev Flow Task belongs to another Host."), nil
	}
	if workflow.ValidateProcessTask(task) != nil {
		return PrepareFileChangeResult{}, domain.ErrStorageUnavailable
	}
	if task.CurrentNode == domain.NodeBlocked {
		return denyFileChange(task, nil, task.Blocker.Message), nil
	}
	if task.CurrentAction == nil || task.TaskPlan == nil ||
		(task.CurrentNode != domain.NodeImplement && task.CurrentNode != domain.NodeRefactor) {
		return PrepareFileChangeResult{Decision: FileChangeAllow, TaskID: task.TaskID, TaskRevision: task.Revision}, nil
	}
	if !request.PathParseComplete {
		return denyFileChange(task, nil, "Dev Flow could not determine every target path for this supported write."), nil
	}
	paths, inside := mapAbsolutePathsToTask(task, request.Paths)
	if !inside || len(paths) == 0 {
		return denyFileChange(task, paths, "The prepared write targets a repository outside the immutable Task Repository Scope."), nil
	}
	outside := unexplainedPreparedPaths(task, paths)
	if len(outside) == 0 {
		return PrepareFileChangeResult{Decision: FileChangeAllow, TaskID: task.TaskID, TaskRevision: task.Revision, Paths: paths}, nil
	}
	if rejectedForCurrentPlan(task, outside) {
		return denyFileChange(task, outside, "The developer rejected this path for the current Task Plan revision."), nil
	}
	if preparedWriteAllowed(task, outside, request.IntentDigest) {
		return PrepareFileChangeResult{Decision: FileChangeAllow, TaskID: task.TaskID, TaskRevision: task.Revision, Paths: paths}, nil
	}
	return s.createFileScopeBlocker(ctx, task, outside, request.IntentDigest)
}

func (s *Service) createFileScopeBlocker(ctx context.Context, task domain.ProcessTask, paths []string, intent domain.Digest) (PrepareFileChangeResult, error) {
	if task.CurrentAction == nil || task.TaskPlan == nil || len(task.FileScopeRecords) >= domain.MaxFileScopeRecords {
		return denyFileChange(task, paths, "Dev Flow cannot retain another file-scope decision for this Task."), nil
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return PrepareFileChangeResult{}, err
	}
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return PrepareFileChangeResult{}, domain.ErrInternal
	}
	if comparison.Relation == recovery.RepositoryForbiddenChange {
		return PrepareFileChangeResult{}, repositoryDriftError(comparison)
	}
	requestID, err := s.id("scope")
	if err != nil {
		return PrepareFileChangeResult{}, err
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return PrepareFileChangeResult{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return PrepareFileChangeResult{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return PrepareFileChangeResult{}, err
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return PrepareFileChangeResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	source := task.CurrentNode
	sourceActionID := task.CurrentAction.ActionID
	next.FileScopeRecords = append(next.FileScopeRecords, domain.FileScopeRecord{
		RequestID: requestID, Paths: append([]string(nil), paths...), IntentDigest: intent,
		TaskPlanRevision: task.TaskPlan.Revision, SourceNode: source, SourceActionID: sourceActionID,
		Decision: domain.FileScopePending, Applicability: domain.FileScopePendingWrite, CreatedAt: now,
	})
	next.CurrentNode = domain.NodeBlocked
	next.ResumeNode = &source
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{
		BlockerID: blockerID, Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCauseFileScopeDecision,
		Message: fileScopeBlockerMessage(paths), ResumeNode: source, ObservedBindingDigest: comparison.ObservedDigest,
		Condition:          domain.BlockerCondition{Kind: domain.BlockerConditionResolveFileScope, ExpectedBindingDigest: task.CurrentAction.RepositoryBindingDigest, ExpectedIdentityDigest: task.CurrentAction.IssuanceIdentityDigest, ExpectedHistoryDigest: task.CurrentAction.IssuanceHistoryDigest, ExpectedContentDigest: task.CurrentAction.IssuanceContentDigest, ScopeRequestID: requestID},
		RequiredResolution: "Choose allow_once, expand_scope or reject and provide a reason before this Host write can continue.", CreatedAt: now,
	}
	workspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return PrepareFileChangeResult{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return PrepareFileChangeResult{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	payloadDigest, err := digestCanonical(struct {
		Host             domain.Host   `json:"host"`
		TaskID           domain.ID     `json:"task_id"`
		SourceActionID   domain.ID     `json:"source_action_id"`
		Paths            []string      `json:"paths"`
		IntentDigest     domain.Digest `json:"intent_digest"`
		TaskPlanRevision uint32        `json:"task_plan_revision"`
	}{task.OriginHost, task.TaskID, sourceActionID, paths, intent, task.TaskPlan.Revision})
	if err != nil {
		return PrepareFileChangeResult{}, domain.ErrInternal
	}
	next.LastOperation = &domain.LastOperation{OperationID: requestID, Kind: domain.OperationPrepareFileChange, ActionID: &sourceActionID, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationPrepareFileChange, SourceNode: source, DestinationNode: domain.NodeBlocked, TransitionReason: next.Blocker.Message, ActionID: &sourceActionID, RequestID: requestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if workflow.ValidateProcessTask(next) != nil {
		return PrepareFileChangeResult{}, domain.ErrInvalidArgument
	}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return PrepareFileChangeResult{}, mapStoreError(err)
	}
	return PrepareFileChangeResult{Decision: FileChangeDeny, Reason: next.Blocker.Message, TaskID: next.TaskID, TaskRevision: next.Revision, ScopeRequestID: requestID, Paths: paths}, nil
}

// createObservedFileScopeBlocker is the final Core guard for writes that did
// not pass through a Host pre-write hook.
func (s *Service) createObservedFileScopeBlocker(ctx context.Context, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, paths []string, operationID domain.ID) (domain.ProcessTask, error) {
	if task.CurrentAction == nil || task.TaskPlan == nil || len(paths) == 0 || len(task.FileScopeRecords) >= domain.MaxFileScopeRecords {
		return domain.ProcessTask{}, domain.ErrInvalidArgument
	}
	requestID, err := s.id("scope")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	observed, err := scopeWorkspaceDigests(task, fresh)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	intent, err := digestCanonical(struct {
		ActionID domain.ID     `json:"action_id"`
		Paths    []string      `json:"paths"`
		Content  domain.Digest `json:"content_digest"`
	}{task.CurrentAction.ActionID, paths, observed.Content})
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	now := s.now().UTC()
	source := task.CurrentNode
	sourceActionID := task.CurrentAction.ActionID
	next.FileScopeRecords = append(next.FileScopeRecords, domain.FileScopeRecord{
		RequestID:        requestID,
		Paths:            append([]string(nil), paths...),
		IntentDigest:     intent,
		TaskPlanRevision: task.TaskPlan.Revision,
		SourceNode:       source,
		SourceActionID:   sourceActionID,
		Decision:         domain.FileScopePending,
		Applicability:    domain.FileScopePendingWrite,
		Observed:         true,
		CreatedAt:        now,
	})
	next.CurrentNode = domain.NodeBlocked
	next.ResumeNode = &source
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{BlockerID: blockerID, Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCauseFileScopeDecision, Message: fileScopeBlockerMessage(paths), ResumeNode: source, ObservedBindingDigest: observed.Binding, Condition: domain.BlockerCondition{Kind: domain.BlockerConditionResolveFileScope, ExpectedBindingDigest: task.CurrentAction.RepositoryBindingDigest, ExpectedIdentityDigest: task.CurrentAction.IssuanceIdentityDigest, ExpectedHistoryDigest: task.CurrentAction.IssuanceHistoryDigest, ExpectedContentDigest: task.CurrentAction.IssuanceContentDigest, ScopeRequestID: requestID}, RequiredResolution: "Choose allow_once, expand_scope or reject and provide a reason for the observed Task worktree paths.", CreatedAt: now}
	workspace, _ := next.EffectiveWorkspaceDigests()
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	payloadDigest, err := digestCanonical(struct {
		TaskID         domain.ID `json:"task_id"`
		ScopeRequestID domain.ID `json:"scope_request_id"`
		Paths          []string  `json:"paths"`
	}{task.TaskID, requestID, paths})
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	next.LastOperation = &domain.LastOperation{OperationID: operationID, Kind: domain.OperationObserveWorkspace, ActionID: &sourceActionID, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: next.Revision, Kind: domain.OperationObserveWorkspace, SourceNode: source, DestinationNode: domain.NodeBlocked, TransitionReason: next.Blocker.Message, ActionID: &sourceActionID, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: operationID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return domain.ProcessTask{}, mapStoreError(err)
	}
	return next, nil
}

func mapAbsolutePathsToTask(task domain.ProcessTask, absolute []string) ([]string, bool) {
	type root struct {
		key  domain.RepositoryKey
		path string
	}
	roots := []root{{task.EffectivePrimaryRepositoryKey(), task.WorkspaceOrigin.CanonicalWorktreeRoot}}
	for _, entry := range task.AdditionalRepositories {
		roots = append(roots, root{entry.Key, entry.Origin.CanonicalWorktreeRoot})
	}
	sort.Slice(roots, func(i, j int) bool { return len(roots[i].path) > len(roots[j].path) })
	seen := map[string]bool{}
	result := make([]string, 0, len(absolute))
	for _, candidate := range absolute {
		if !utf8.ValidString(candidate) || !filepath.IsAbs(candidate) || filepath.Clean(candidate) != candidate || len(candidate) > domain.MaxRepositoryPathBytes {
			return result, false
		}
		matched := false
		for _, repository := range roots {
			relative, err := filepath.Rel(repository.path, candidate)
			if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || filepath.IsAbs(relative) {
				continue
			}
			relative = filepath.ToSlash(relative)
			scoped := relative
			if len(task.AdditionalRepositories) != 0 {
				scoped = string(repository.key) + "::" + relative
			}
			if task.ValidateRepositoryPath(scoped) != nil {
				return result, false
			}
			if !seen[scoped] {
				seen[scoped] = true
				result = append(result, scoped)
			}
			matched = true
			break
		}
		if !matched {
			return result, false
		}
	}
	sort.Strings(result)
	return result, true
}

func unexplainedPreparedPaths(task domain.ProcessTask, paths []string) []string {
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		if !task.PathExpectedByCurrentPlan(path) {
			result = append(result, path)
		}
	}
	return result
}

func rejectedForCurrentPlan(task domain.ProcessTask, paths []string) bool {
	if task.TaskPlan == nil {
		return false
	}
	for _, record := range task.FileScopeRecords {
		if record.Decision != domain.FileScopeReject || record.TaskPlanRevision != task.TaskPlan.Revision {
			continue
		}
		for _, rejected := range record.Paths {
			for _, path := range paths {
				if rejected == path {
					return true
				}
			}
		}
	}
	return false
}

func preparedWriteAllowed(task domain.ProcessTask, paths []string, intent domain.Digest) bool {
	if task.TaskPlan == nil || task.CurrentAction == nil {
		return false
	}
	for _, record := range task.FileScopeRecords {
		if record.Decision == domain.FileScopeAllowOnce && !record.Consumed &&
			record.TaskPlanRevision == task.TaskPlan.Revision && record.IntentDigest == intent &&
			record.AllowedActionID != nil && *record.AllowedActionID == task.CurrentAction.ActionID && sameStrings(record.Paths, paths) {
			return true
		}
	}
	return false
}

func unexplainedTaskPaths(task domain.ProcessTask, primary domain.RepositoryBinding, additional []domain.RepositoryScopeEntry) []string {
	return task.UnexplainedChangedPaths(primary, additional)
}

func consumeFileScopeAuthorizations(task *domain.ProcessTask, paths []string, actionID domain.ID) error {
	for index := range task.FileScopeRecords {
		record := &task.FileScopeRecords[index]
		if record.Decision == domain.FileScopeAllowOnce && !record.Consumed && record.AllowedActionID != nil && *record.AllowedActionID == actionID && containsAll(paths, record.Paths) {
			states, err := task.FileScopePathStates(record.Paths)
			if err != nil {
				return domain.ErrInternal
			}
			record.Consumed = true
			record.AcceptedPathStates = states
		}
	}
	return nil
}

func mergeSortedPaths(left, right []string) []string {
	set := make(map[string]bool, len(left)+len(right))
	for _, path := range left {
		set[path] = true
	}
	for _, path := range right {
		set[path] = true
	}
	result := make([]string, 0, len(set))
	for path := range set {
		result = append(result, path)
	}
	sort.Strings(result)
	return result
}

func containsAll(values, wanted []string) bool {
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

func sameStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func fileScopeBlockerMessage(paths []string) string {
	const prefix = "A supported Host write is outside the current Task Plan ExpectedPaths: "
	var builder strings.Builder
	builder.WriteString(prefix)
	for index, path := range paths {
		separator := ""
		if index > 0 {
			separator = ", "
		}
		if builder.Len()+len(separator)+len(path)+1 > domain.MaxBlockerMessageBytes {
			builder.WriteString(", and additional paths")
			break
		}
		builder.WriteString(separator)
		builder.WriteString(path)
	}
	builder.WriteString(".")
	return builder.String()
}

func denyFileChange(task domain.ProcessTask, paths []string, reason string) PrepareFileChangeResult {
	return PrepareFileChangeResult{Decision: FileChangeDeny, Reason: reason, TaskID: task.TaskID, TaskRevision: task.Revision, Paths: append([]string(nil), paths...)}
}

func CurrentFileScopeStatus(task domain.ProcessTask) FileScopeStatus {
	expectedSet := map[string]bool{}
	if task.TaskPlan != nil {
		for _, item := range task.TaskPlan.WorkItems {
			for _, path := range item.ExpectedPaths {
				expectedSet[path] = true
			}
		}
	}
	expected := make([]string, 0, len(expectedSet))
	for path := range expectedSet {
		expected = append(expected, path)
	}
	sort.Strings(expected)
	covered := []string{}
	for name := range supportedFileChangeTools[task.OriginHost] {
		covered = append(covered, name)
	}
	sort.Strings(covered)
	return FileScopeStatus{
		ExpectedPaths: expected, CurrentChangedPaths: append([]string(nil), task.CurrentChangedPaths...),
		UnexplainedPaths: unexplainedTaskPaths(task, task.Repository, task.AdditionalRepositories), Records: append([]domain.FileScopeRecord(nil), task.FileScopeRecords...),
		CoveredHostTools: covered, FinalCheckEnabled: task.TaskPlan != nil,
	}
}

func fileScopeResolutionRepositoryCurrent(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) bool {
	if comparison.Relation == recovery.RepositoryForbiddenChange {
		return false
	}
	unexplained := unexplainedTaskPaths(task, fresh.Primary, fresh.Additional)
	if len(unexplained) == 0 {
		return true
	}
	if task.Blocker == nil {
		return false
	}
	for _, record := range task.FileScopeRecords {
		if record.RequestID == task.Blocker.Condition.ScopeRequestID {
			return containsAll(record.Paths, unexplained)
		}
	}
	return false
}

func observedTaskDeltaPaths(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation) []string {
	return recovery.RepositoryScopeDeltaPaths(task, fresh)
}

func repositoryDeltaPaths(authoritative, observed []string, prefix string) []string {
	existing := make(map[string]bool, len(authoritative))
	for _, path := range authoritative {
		existing[path] = true
	}
	result := []string{}
	for _, path := range observed {
		if !existing[path] {
			result = append(result, prefix+path)
		}
	}
	return result
}
