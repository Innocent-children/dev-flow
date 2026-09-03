package recovery

import (
	"bytes"
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type BlockerResolutionPayload = domain.BlockerResolutionPayload

func CompareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, error) {
	relation, _, err := compareRepositoryBindings(authoritative, fresh)
	return relation, err
}

func compareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, RepositoryReason, error) {
	if authoritative.Validate() != nil || fresh.Validate() != nil {
		return "", "", domain.ErrInvalidArgument
	}
	if authoritative.WorktreeInstanceDigest != fresh.WorktreeInstanceDigest || authoritative.IdentityDigest != fresh.IdentityDigest {
		return RepositoryForbiddenChange, RepositoryReasonWorktreeInstance, nil
	}
	if fresh.HistoryRelation != domain.RepositoryHistoryExact && fresh.HistoryRelation != domain.RepositoryHistoryLinearAdvance {
		return RepositoryForbiddenChange, RepositoryReasonHistory, nil
	}
	if authoritative.BindingDigest == fresh.BindingDigest {
		return RepositoryExact, RepositoryReasonExact, nil
	}
	reason := RepositoryReasonHistory
	if authoritative.ContentDigest != fresh.ContentDigest {
		reason = RepositoryReasonContent
	}
	return RepositoryWorktreeOnlyChanged, reason, nil
}

func CompareRepositoryScope(task domain.ProcessTask, observed RepositoryScopeObservation) (RepositoryScopeComparison, error) {
	if workflow.ValidateProcessTask(task) != nil || observed.Primary.Validate() != nil || len(observed.Additional) != len(task.AdditionalRepositories) {
		return RepositoryScopeComparison{}, domain.ErrInvalidArgument
	}
	facts := make([]RepositoryFact, 0, len(task.AdditionalRepositories)+1)
	relation := RepositoryExact
	observedAt := observed.Primary.ObservedAt
	appendFact := func(key domain.RepositoryKey, authoritative, fresh domain.RepositoryBinding) error {
		entryRelation, reason, err := compareRepositoryBindings(authoritative, fresh)
		if err != nil {
			return err
		}
		facts = append(facts, RepositoryFact{RepositoryKey: key, Relation: entryRelation, Reason: reason})
		if entryRelation == RepositoryForbiddenChange {
			relation = RepositoryForbiddenChange
		} else if entryRelation == RepositoryWorktreeOnlyChanged && relation == RepositoryExact {
			relation = RepositoryWorktreeOnlyChanged
		}
		return nil
	}
	if err := appendFact(task.EffectivePrimaryRepositoryKey(), task.Repository, observed.Primary); err != nil {
		return RepositoryScopeComparison{}, err
	}
	for i, entry := range task.AdditionalRepositories {
		fresh := observed.Additional[i]
		if fresh.Key != entry.Key || fresh.Binding.Validate() != nil {
			return RepositoryScopeComparison{}, domain.ErrInvalidArgument
		}
		if err := appendFact(entry.Key, entry.Binding, fresh.Binding); err != nil {
			return RepositoryScopeComparison{}, err
		}
		observedAt = fresh.Binding.ObservedAt
	}
	sort.Slice(facts, func(i, j int) bool { return facts[i].RepositoryKey < facts[j].RepositoryKey })
	digestTask := task
	digestTask.Repository = observed.Primary.Clone()
	digestTask.AdditionalRepositories = make([]domain.RepositoryScopeEntry, len(task.AdditionalRepositories))
	for i, entry := range task.AdditionalRepositories {
		digestTask.AdditionalRepositories[i] = domain.RepositoryScopeEntry{Key: entry.Key, Origin: entry.Origin, Binding: observed.Additional[i].Binding.Clone()}
	}
	digest, err := digestTask.EffectiveRepositoryBindingDigest()
	if err != nil {
		return RepositoryScopeComparison{}, domain.ErrInvalidArgument
	}
	return RepositoryScopeComparison{Relation: relation, Repositories: facts, ObservedDigest: digest, ObservedAt: observedAt}, nil
}

func BindingAcceptedForAction(action domain.ActionKind, relation RepositoryRelation) (bool, error) {
	if !action.IsValid() || !relation.IsValid() {
		return false, domain.ErrInvalidArgument
	}
	switch action {
	case domain.ActionCompleteImplementation, domain.ActionCompleteRefactor:
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged, nil
	default:
		return relation == RepositoryExact, nil
	}
}

func Reconcile(input ReconcileInput) (RecoveryDecision, error) {
	if !input.Host.IsValid() || workflow.ValidateProcessTask(input.Task) != nil ||
		workflow.ValidateOperationReference(input.Operation) != nil ||
		input.Task.OriginHost != input.Host || input.Task.Process != input.Operation.Process || len(input.Payload) == 0 {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	observation, err := reconcileObservation(input)
	if err != nil {
		return RecoveryDecision{}, err
	}
	comparison, err := CompareRepositoryScope(input.Task, observation)
	if err != nil {
		return RecoveryDecision{}, err
	}
	relation := comparison.Relation

	payloadRetained := !bytes.Equal(bytes.TrimSpace(input.Payload), []byte("null"))
	var canonical json.RawMessage
	var payloadDigest *domain.Digest
	evidence := OperationEvidenceNone
	if payloadRetained {
		var effect RepositoryEffect
		if input.Operation.SourceCursor == domain.NodeBlocked {
			payload, raw, decodeErr := DecodeBlockerResolutionPayload(input.Payload)
			if decodeErr != nil {
				return RecoveryDecision{}, decodeErr
			}
			canonical = raw
			effect = RepositoryEffect{Kind: EffectExactBlockerRestoration}
			if payload.Condition.Kind == domain.BlockerConditionResolveFileScope {
				effect = RepositoryEffect{Kind: EffectFileScopeResolution}
			}
			if input.Task.Blocker == nil || payload.BlockerID != input.Task.Blocker.BlockerID ||
				payload.Condition != input.Task.Blocker.Condition || payload.ObservedBindingDigest != comparison.ObservedDigest {
				evidence = OperationEvidenceContradictory
			}
		} else {
			envelope, result, decodeErr := workflow.DecodeStandardPayload(input.Operation.SourceCursor, input.Payload)
			if decodeErr != nil {
				return RecoveryDecision{}, domain.ErrInvalidArgument
			}
			node, nodeErr := workflow.NodeDefinition(workflow.StandardProcess(), input.Operation.SourceCursor)
			if nodeErr != nil || workflow.ValidatePayload(workflow.StandardProcess(), input.Operation.SourceCursor, envelope, result, node.SemanticMethodSteps) != nil {
				return RecoveryDecision{}, domain.ErrInvalidArgument
			}
			canonical, err = workflow.CanonicalValidatedPayload(envelope, result)
			if err != nil {
				return RecoveryDecision{}, domain.ErrInvalidArgument
			}
			effect, err = DeriveRepositoryEffect(input.Operation.SourceCursor, envelope, result)
			if err != nil {
				return RecoveryDecision{}, err
			}
			if !RepositoryEffectAllowed(node.AllowedEffects, effect) {
				return RecoveryDecision{}, domain.ErrRepositoryDrift
			}
		}
		digest, digestErr := workflow.GraphOperationDigest(input.Host, input.Task.TaskID, input.Operation, canonical)
		if digestErr != nil {
			return RecoveryDecision{}, domain.ErrInvalidArgument
		}
		payloadDigest = &digest
		if evidence != OperationEvidenceContradictory {
			evidence = RepositoryScopeEffectEvidence(input.Task, observation, comparison, effect)
		}
	}

	lastRelation, proof := compareLastOperation(input.Task.LastOperation, input.Operation, payloadDigest, input.Task.Revision)
	authoritativeDigest, err := input.Task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	repositoryFacts := comparison.Repositories
	if len(input.Task.AdditionalRepositories) == 0 {
		repositoryFacts = nil
	}
	facts := ClassificationFacts{
		Operation:                    input.Operation,
		TaskRevision:                 input.Task.Revision,
		CurrentNode:                  input.Task.CurrentNode,
		CurrentActionID:              currentActionID(input.Task.CurrentAction),
		IssuanceBindingDigest:        input.Operation.RepositoryBindingDigest,
		AuthoritativeBindingDigest:   authoritativeDigest,
		ObservedBindingDigest:        comparison.ObservedDigest,
		RepositoryRelation:           relation,
		Repositories:                 repositoryFacts,
		LastOperationRelation:        lastRelation,
		OperationEvidence:            evidence,
		OperationPayloadDigest:       payloadDigest,
		CommittedProof:               proof,
		SourceCurrent:                sourceCurrent(input.Task, input.Operation, authoritativeDigest),
		PayloadRetained:              payloadRetained,
		MayHavePartialRepositoryWork: mayHavePartialRepositoryWork(input.Operation, relation, observation),
		ExistingBlocker:              input.Task.Blocker,
		ObservedAt:                   comparison.ObservedAt,
	}
	decision, err := Classify(facts)
	if err != nil {
		return RecoveryDecision{}, err
	}
	decision.CanonicalPayload = canonical
	return decision, nil
}

func reconcileObservation(input ReconcileInput) (RepositoryScopeObservation, error) {
	if input.ObservedScope != nil {
		if input.Observed.WorktreeInstanceDigest != "" {
			return RepositoryScopeObservation{}, domain.ErrInvalidArgument
		}
		return *input.ObservedScope, nil
	}
	if input.Observed.Validate() != nil || len(input.Task.AdditionalRepositories) != 0 {
		return RepositoryScopeObservation{}, domain.ErrInvalidArgument
	}
	return RepositoryScopeObservation{Primary: input.Observed}, nil
}

func operationEvidenceFor(effect RepositoryEffect, relation RepositoryRelation, authoritative, observed domain.RepositoryBinding) OperationEvidenceState {
	if relation == RepositoryForbiddenChange {
		return OperationEvidenceContradictory
	}
	delta := bindingDeltaPaths(authoritative, observed)
	if len(delta) == 0 {
		return OperationEvidenceComplete
	}
	if effect.Kind == EffectProcessArtifactOnly && containsEveryPath(effect.Paths, delta) {
		return OperationEvidenceComplete
	}
	if effect.Kind == EffectProductFileChange {
		return OperationEvidenceComplete
	}
	return OperationEvidenceContradictory
}

func RepositoryScopeEffectEvidence(task domain.ProcessTask, observed RepositoryScopeObservation, comparison RepositoryScopeComparison, effect RepositoryEffect) OperationEvidenceState {
	if effect.Kind == EffectProductFileChange && len(task.UnexplainedChangedPaths(observed.Primary, observed.Additional)) != 0 {
		return OperationEvidenceContradictory
	}
	if len(task.AdditionalRepositories) == 0 {
		return operationEvidenceFor(effect, comparison.Relation, task.Repository, observed.Primary)
	}
	authoritative := map[domain.RepositoryKey]domain.RepositoryBinding{task.EffectivePrimaryRepositoryKey(): task.Repository}
	fresh := map[domain.RepositoryKey]domain.RepositoryBinding{task.EffectivePrimaryRepositoryKey(): observed.Primary}
	for i, entry := range task.AdditionalRepositories {
		authoritative[entry.Key] = entry.Binding
		fresh[entry.Key] = observed.Additional[i].Binding
	}
	if effect.Kind == EffectFileScopeResolution {
		if comparison.Relation == RepositoryExact || comparison.Relation == RepositoryWorktreeOnlyChanged {
			return OperationEvidenceComplete
		}
		return OperationEvidenceContradictory
	}
	declared := map[domain.RepositoryKey][]string{}
	for _, scopedPath := range effect.Paths {
		keyText, path, ok := strings.Cut(scopedPath, "::")
		if ok {
			declared[domain.RepositoryKey(keyText)] = append(declared[domain.RepositoryKey(keyText)], path)
		}
	}
	completed := 0
	for key, binding := range authoritative {
		delta := bindingDeltaPaths(binding, fresh[key])
		if len(delta) == 0 {
			continue
		}
		if effect.Kind == EffectProductFileChange || effect.Kind == EffectProcessArtifactOnly && containsEveryPath(declared[key], delta) {
			completed++
			continue
		}
		return OperationEvidenceContradictory
	}
	if comparison.Relation == RepositoryForbiddenChange {
		return OperationEvidenceContradictory
	}
	if completed > 0 || comparison.Relation == RepositoryExact || comparison.Relation == RepositoryWorktreeOnlyChanged {
		return OperationEvidenceComplete
	}
	return OperationEvidenceNone
}

func DeriveRepositoryEffect(source domain.NodeID, envelope workflow.StandardPayload, result any) (RepositoryEffect, error) {
	for index, artifact := range envelope.Artifacts {
		if !workflow.ArtifactRoleAllowed(source, artifact.Role) {
			return RepositoryEffect{}, domain.InvalidArgumentViolations(domain.Violation("payload.artifacts["+strconv.Itoa(index)+"].role", domain.RuleArtifactRoleNotAllowed))
		}
	}
	switch value := result.(type) {
	case *workflow.RequirementsResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	case *workflow.DesignResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	case *workflow.TasksResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	case *workflow.ImplementationResult:
		_ = value
		return RepositoryEffect{Kind: EffectProductFileChange}, nil
	case *workflow.TestResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	case *workflow.ComprehensionResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	case *workflow.RefactorResult:
		_ = value
		return RepositoryEffect{Kind: EffectProductFileChange}, nil
	case *workflow.DeliveryResult:
		_ = value
		return processArtifactEffect(envelope.Artifacts), nil
	default:
		return RepositoryEffect{}, domain.ErrInvalidArgument
	}
}

func processArtifactEffect(artifacts []domain.ArtifactReference) RepositoryEffect {
	paths := make([]string, 0, len(artifacts))
	for _, artifact := range artifacts {
		paths = append(paths, artifact.Path)
	}
	return RepositoryEffect{Kind: EffectProcessArtifactOnly, Paths: sortedPaths(paths)}
}

func RepositoryEffectAllowed(allowed []domain.AllowedEffect, effect RepositoryEffect) bool {
	var wanted domain.AllowedEffect
	switch effect.Kind {
	case EffectExactBinding, EffectExactBlockerRestoration:
		return len(effect.Paths) == 0
	case EffectProcessArtifactOnly:
		wanted = domain.EffectEditProcessArtifacts
	case EffectProductFileChange:
		wanted = domain.EffectEditProductFiles
	default:
		return false
	}
	for _, candidate := range allowed {
		if candidate == wanted {
			return true
		}
	}
	return false
}

func RepositoryEffectMatches(effect RepositoryEffect, relation RepositoryRelation, authoritative, observed domain.RepositoryBinding) bool {
	if relation == RepositoryForbiddenChange {
		return false
	}
	delta := bindingDeltaPaths(authoritative, observed)
	switch effect.Kind {
	case EffectExactBinding, EffectExactBlockerRestoration:
		return len(delta) == 0
	case EffectFileScopeResolution:
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged
	case EffectProcessArtifactOnly:
		return len(delta) == 0 || containsEveryPath(effect.Paths, delta)
	case EffectProductFileChange:
		return true
	default:
		return false
	}
}

func bindingDeltaPaths(authoritative, observed domain.RepositoryBinding) []string {
	before := map[string]domain.RepositoryChangedEntry{}
	for _, entry := range authoritative.TaskSurface {
		before[entry.Path] = entry
	}
	after := map[string]domain.RepositoryChangedEntry{}
	for _, entry := range observed.TaskSurface {
		after[entry.Path] = entry
	}
	set := map[string]bool{}
	for path, entry := range before {
		if other, ok := after[path]; !ok || !sameEffectivePathState(entry, other) {
			set[path] = true
		}
	}
	for path, entry := range after {
		if other, ok := before[path]; !ok || !sameEffectivePathState(entry, other) {
			set[path] = true
		}
	}
	paths := make([]string, 0, len(set))
	for path := range set {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}

func sameEffectivePathState(left, right domain.RepositoryChangedEntry) bool {
	return left.Path == right.Path &&
		left.ChangeType == right.ChangeType &&
		left.FileMode == right.FileMode &&
		left.Gitlink == right.Gitlink &&
		left.ContentDigest == right.ContentDigest
}

func RepositoryScopeDeltaPaths(task domain.ProcessTask, observed RepositoryScopeObservation) []string {
	prefix := ""
	if len(task.AdditionalRepositories) != 0 {
		prefix = string(task.EffectivePrimaryRepositoryKey()) + "::"
	}
	paths := bindingDeltaPaths(task.Repository, observed.Primary)
	for i := range paths {
		paths[i] = prefix + paths[i]
	}
	for i, entry := range task.AdditionalRepositories {
		for _, path := range bindingDeltaPaths(entry.Binding, observed.Additional[i].Binding) {
			paths = append(paths, string(entry.Key)+"::"+path)
		}
	}
	sort.Strings(paths)
	return paths
}

func RepositoryScopeCurrentPaths(task domain.ProcessTask, observed RepositoryScopeObservation) []string {
	prefix := ""
	if len(task.AdditionalRepositories) != 0 {
		prefix = string(task.EffectivePrimaryRepositoryKey()) + "::"
	}
	paths := domain.RepositoryChangedPaths(observed.Primary.TaskSurface)
	for i := range paths {
		paths[i] = prefix + paths[i]
	}
	for _, entry := range observed.Additional {
		for _, path := range domain.RepositoryChangedPaths(entry.Binding.TaskSurface) {
			paths = append(paths, string(entry.Key)+"::"+path)
		}
	}
	sort.Strings(paths)
	return paths
}

func containsEveryPath(allowed, actual []string) bool {
	set := map[string]bool{}
	for _, path := range allowed {
		set[path] = true
	}
	for _, path := range actual {
		if !set[path] {
			return false
		}
	}
	return true
}

func DecodeBlockerResolutionPayload(raw []byte) (BlockerResolutionPayload, json.RawMessage, error) {
	return workflow.DecodeBlockerResolutionPayload(raw)
}

func compareLastOperation(last *domain.LastOperation, operation domain.OperationReference, digest *domain.Digest, taskRevision uint64) (LastOperationRelation, *CommittedOperationProof) {
	if last == nil {
		return LastOperationUnrelated, nil
	}
	actionMatches := last.ActionID != nil && *last.ActionID == operation.ActionID
	if last.OperationID == operation.OperationID {
		if digest != nil && last.Kind == domain.OperationApplyAction && actionMatches &&
			last.FromRevision == operation.ExpectedRevision && last.ToRevision == operation.ExpectedRevision+1 &&
			last.ToRevision == taskRevision && last.PayloadDigest == *digest {
			return LastOperationExact, &CommittedOperationProof{OperationID: last.OperationID, Kind: last.Kind, ActionID: *last.ActionID, FromRevision: last.FromRevision, ToRevision: last.ToRevision, PayloadDigest: last.PayloadDigest, CommittedAt: last.CommittedAt}
		}
		return LastOperationContradictory, nil
	}
	if actionMatches && last.Kind == domain.OperationApplyAction && last.FromRevision == operation.ExpectedRevision {
		return LastOperationContradictory, nil
	}
	return LastOperationUnrelated, nil
}

func sourceCurrent(task domain.ProcessTask, operation domain.OperationReference, authoritativeDigest domain.Digest) bool {
	return task.Revision == operation.ExpectedRevision && task.CurrentNode == operation.SourceCursor &&
		task.CurrentAction != nil && task.CurrentAction.ActionID == operation.ActionID &&
		task.CurrentAction.Kind == operation.ActionKind && task.CurrentAction.Process == operation.Process &&
		task.CurrentAction.NodeID == operation.SourceCursor &&
		task.CurrentAction.RepositoryBindingDigest == operation.RepositoryBindingDigest &&
		task.CurrentAction.IssuanceIdentityDigest == operation.IssuanceIdentityDigest &&
		task.CurrentAction.IssuanceHistoryDigest == operation.IssuanceHistoryDigest &&
		task.CurrentAction.IssuanceContentDigest == operation.IssuanceContentDigest &&
		authoritativeDigest == operation.RepositoryBindingDigest
}

func mayHavePartialRepositoryWork(operation domain.OperationReference, relation RepositoryRelation, observed RepositoryScopeObservation) bool {
	changed := len(observed.Primary.TaskSurface) > 0
	for _, entry := range observed.Additional {
		changed = changed || len(entry.Binding.TaskSurface) > 0
	}
	return relation == RepositoryWorktreeOnlyChanged && changed &&
		(operation.ActionKind == domain.ActionCompleteImplementation || operation.ActionKind == domain.ActionCompleteRefactor)
}

func currentActionID(action *domain.ProcessAction) *domain.ID {
	if action == nil {
		return nil
	}
	id := action.ActionID
	return &id
}

func sortedPaths(paths []string) []string {
	result := append([]string(nil), paths...)
	sort.Strings(result)
	return result
}

func samePaths(left, right []string) bool {
	left, right = sortedPaths(left), sortedPaths(right)
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func sameText(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func rejectDuplicateMembers(raw []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	var walk func() error
	walk = func() error {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		delimiter, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		if delimiter == '{' {
			seen := map[string]bool{}
			for decoder.More() {
				keyToken, err := decoder.Token()
				if err != nil {
					return err
				}
				key := keyToken.(string)
				if seen[key] {
					return domain.ErrInvalidArgument
				}
				seen[key] = true
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = decoder.Token()
			return err
		}
		if delimiter == '[' {
			for decoder.More() {
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = decoder.Token()
			return err
		}
		return nil
	}
	return walk()
}
