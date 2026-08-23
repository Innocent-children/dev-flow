package recovery

import (
	"bytes"
	"encoding/json"
	"io"
	"sort"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type BlockerResolutionPayload struct {
	BlockerID             domain.ID               `json:"blocker_id"`
	Condition             domain.BlockerCondition `json:"condition"`
	ObservedBindingDigest domain.Digest           `json:"observed_binding_digest"`
}

func CompareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, error) {
	relation, _, err := compareRepositoryBindings(authoritative, fresh)
	return relation, err
}

func compareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, RepositoryReason, error) {
	if authoritative.Validate() != nil || fresh.Validate() != nil {
		return "", "", domain.ErrInvalidArgument
	}
	identity := authoritative.CanonicalRoot == fresh.CanonicalRoot &&
		authoritative.GitCommonDirDigest == fresh.GitCommonDirDigest &&
		authoritative.RepositoryIdentity == fresh.RepositoryIdentity &&
		sameText(authoritative.Branch, fresh.Branch) && authoritative.Detached == fresh.Detached &&
		sameText(authoritative.Head, fresh.Head) && authoritative.Unborn == fresh.Unborn
	if identity && authoritative.WorktreeFingerprint == fresh.WorktreeFingerprint && authoritative.BindingDigest == fresh.BindingDigest {
		return RepositoryExact, RepositoryReasonExact, nil
	}
	if identity && authoritative.WorktreeFingerprint != fresh.WorktreeFingerprint && authoritative.BindingDigest != fresh.BindingDigest {
		return RepositoryWorktreeOnlyChanged, RepositoryReasonWorktreeChanged, nil
	}
	reason := RepositoryReasonBinding
	switch {
	case authoritative.CanonicalRoot != fresh.CanonicalRoot:
		reason = RepositoryReasonCanonicalRoot
	case authoritative.GitCommonDirDigest != fresh.GitCommonDirDigest:
		reason = RepositoryReasonGitCommonDir
	case authoritative.RepositoryIdentity != fresh.RepositoryIdentity:
		reason = RepositoryReasonIdentity
	case !sameText(authoritative.Branch, fresh.Branch):
		reason = RepositoryReasonBranch
	case !sameText(authoritative.Head, fresh.Head):
		reason = RepositoryReasonHead
	case authoritative.Detached != fresh.Detached:
		reason = RepositoryReasonDetached
	case authoritative.Unborn != fresh.Unborn:
		reason = RepositoryReasonUnborn
	}
	return RepositoryForbiddenChange, reason, nil
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
	digestTask.Repository = observedDigestBinding(task.Repository, observed.Primary)
	digestTask.AdditionalRepositories = make([]domain.RepositoryScopeEntry, len(task.AdditionalRepositories))
	for i, entry := range task.AdditionalRepositories {
		digestTask.AdditionalRepositories[i] = domain.RepositoryScopeEntry{Key: entry.Key, Binding: observedDigestBinding(entry.Binding, observed.Additional[i].Binding)}
	}
	digest, err := digestTask.EffectiveRepositoryBindingDigest()
	if err != nil {
		return RepositoryScopeComparison{}, domain.ErrInvalidArgument
	}
	return RepositoryScopeComparison{Relation: relation, Repositories: facts, ObservedDigest: digest, ObservedAt: observedAt}, nil
}

func observedDigestBinding(authoritative, observed domain.RepositoryBinding) domain.RepositoryBinding {
	binding := observed.Clone()
	binding.CanonicalRoot = authoritative.CanonicalRoot
	binding.GitCommonDirDigest = authoritative.GitCommonDirDigest
	binding.RepositoryIdentity = authoritative.RepositoryIdentity
	return binding
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
			effect = RepositoryEffect{Kind: EffectExactBlockerRestoration, NoFileChanges: true}
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
		if input.Observed.CanonicalRoot != "" {
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
	if relation == RepositoryExact && !effect.NoFileChanges &&
		(effect.Kind == EffectProductFileChange || effect.Kind == EffectProcessArtifactOnly) {
		return OperationEvidenceNone
	}
	if RepositoryEffectMatches(effect, relation, authoritative, observed) {
		return OperationEvidenceComplete
	}
	return OperationEvidenceContradictory
}

func RepositoryScopeEffectEvidence(task domain.ProcessTask, observed RepositoryScopeObservation, comparison RepositoryScopeComparison, effect RepositoryEffect) OperationEvidenceState {
	if len(task.AdditionalRepositories) == 0 {
		return operationEvidenceFor(effect, comparison.Relation, task.Repository, observed.Primary)
	}
	authoritative := map[domain.RepositoryKey]domain.RepositoryBinding{task.EffectivePrimaryRepositoryKey(): task.Repository}
	fresh := map[domain.RepositoryKey]domain.RepositoryBinding{task.EffectivePrimaryRepositoryKey(): observed.Primary}
	relations := map[domain.RepositoryKey]RepositoryRelation{}
	for _, fact := range comparison.Repositories {
		relations[fact.RepositoryKey] = fact.Relation
	}
	for i, entry := range task.AdditionalRepositories {
		authoritative[entry.Key] = entry.Binding
		fresh[entry.Key] = observed.Additional[i].Binding
	}
	if effect.NoFileChanges && len(effect.ChangedPaths) == 0 {
		if comparison.Relation == RepositoryExact {
			return OperationEvidenceComplete
		}
		return OperationEvidenceContradictory
	}
	declared := map[domain.RepositoryKey][]string{}
	for _, scopedPath := range effect.ChangedPaths {
		keyText, path, ok := strings.Cut(scopedPath, "::")
		key := domain.RepositoryKey(keyText)
		if !ok || path == "" || authoritative[key].Validate() != nil {
			return OperationEvidenceContradictory
		}
		declared[key] = append(declared[key], path)
	}
	if len(declared) == 0 {
		return OperationEvidenceContradictory
	}
	completed := 0
	for key, binding := range authoritative {
		paths := declared[key]
		if len(paths) == 0 {
			if relations[key] != RepositoryExact {
				return OperationEvidenceContradictory
			}
			continue
		}
		componentEffect := effect
		componentEffect.ChangedPaths = paths
		componentEffect.NoFileChanges = false
		if RepositoryEffectMatches(componentEffect, relations[key], binding, fresh[key]) {
			completed++
			continue
		}
		if relations[key] != RepositoryExact {
			return OperationEvidenceContradictory
		}
	}
	if completed == len(declared) {
		return OperationEvidenceComplete
	}
	if completed > 0 {
		return OperationEvidencePartial
	}
	return OperationEvidenceNone
}

func DeriveRepositoryEffect(source domain.NodeID, envelope workflow.StandardPayload, result any) (RepositoryEffect, error) {
	switch value := result.(type) {
	case *workflow.ImplementationResult:
		return RepositoryEffect{Kind: EffectProductFileChange, ChangedPaths: sortedPaths(value.ChangedPaths), NoFileChanges: value.NoFileChanges}, nil
	case *workflow.RefactorResult:
		return RepositoryEffect{Kind: EffectProductFileChange, ChangedPaths: sortedPaths(value.ChangedPaths), NoFileChanges: value.NoFileChanges}, nil
	}
	paths := make([]string, 0, len(envelope.Artifacts))
	for _, artifact := range envelope.Artifacts {
		if !artifactRoleAllowed(source, artifact.Role) {
			return RepositoryEffect{}, domain.ErrInvalidArgument
		}
		paths = append(paths, artifact.Path)
	}
	if len(paths) == 0 {
		return RepositoryEffect{Kind: EffectExactBinding, NoFileChanges: true}, nil
	}
	return RepositoryEffect{Kind: EffectProcessArtifactOnly, ChangedPaths: sortedPaths(paths)}, nil
}

func RepositoryEffectMatches(effect RepositoryEffect, relation RepositoryRelation, authoritative, observed domain.RepositoryBinding) bool {
	if relation == RepositoryForbiddenChange {
		return false
	}
	switch effect.Kind {
	case EffectExactBinding, EffectExactBlockerRestoration:
		return relation == RepositoryExact
	case EffectProcessArtifactOnly:
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged && matchesDeclaredPaths(authoritative.ChangedPaths, effect.ChangedPaths, observed.ChangedPaths)
	case EffectProductFileChange:
		if effect.NoFileChanges {
			return relation == RepositoryExact && len(effect.ChangedPaths) == 0
		}
		return relation == RepositoryWorktreeOnlyChanged && len(effect.ChangedPaths) > 0 && matchesDeclaredPaths(authoritative.ChangedPaths, effect.ChangedPaths, observed.ChangedPaths)
	default:
		return false
	}
}

func matchesDeclaredPaths(authoritative, declared, observed []string) bool {
	expected := make(map[string]struct{}, len(authoritative)+len(declared))
	for _, path := range authoritative {
		expected[path] = struct{}{}
	}
	for _, path := range declared {
		expected[path] = struct{}{}
	}
	paths := make([]string, 0, len(expected))
	for path := range expected {
		paths = append(paths, path)
	}
	return samePaths(paths, observed)
}

func DecodeBlockerResolutionPayload(raw []byte) (BlockerResolutionPayload, json.RawMessage, error) {
	if len(raw) == 0 || !json.Valid(raw) || rejectDuplicateMembers(raw) != nil {
		return BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var payload BlockerResolutionPayload
	if decoder.Decode(&payload) != nil || decoder.Decode(&struct{}{}) != io.EOF ||
		!payload.BlockerID.IsValid() || payload.Condition.Validate() != nil || !payload.ObservedBindingDigest.IsValid() {
		return BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	canonical, err := json.Marshal(payload)
	if err != nil {
		return BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	return payload, canonical, nil
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
		authoritativeDigest == operation.RepositoryBindingDigest
}

func mayHavePartialRepositoryWork(operation domain.OperationReference, relation RepositoryRelation, observed RepositoryScopeObservation) bool {
	changed := len(observed.Primary.ChangedPaths) > 0
	for _, entry := range observed.Additional {
		changed = changed || len(entry.Binding.ChangedPaths) > 0
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

func artifactRoleAllowed(source domain.NodeID, role domain.ArtifactRole) bool {
	if role == domain.ArtifactOtherProcess {
		return true
	}
	switch source {
	case domain.NodeRequirements:
		return role == domain.ArtifactRequirements
	case domain.NodeDesign:
		return role == domain.ArtifactDesign
	case domain.NodeTasks:
		return role == domain.ArtifactTaskPlan
	case domain.NodeTest:
		return role == domain.ArtifactTest
	case domain.NodeComprehensionReview:
		return role == domain.ArtifactComprehension
	case domain.NodeDelivery:
		return role == domain.ArtifactDelivery
	default:
		return false
	}
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
