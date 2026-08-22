package recovery

import (
	"bytes"
	"encoding/json"
	"io"
	"sort"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type BlockerResolutionPayload struct {
	BlockerID             domain.ID               `json:"blocker_id"`
	Condition             domain.BlockerCondition `json:"condition"`
	ObservedBindingDigest domain.Digest           `json:"observed_binding_digest"`
}

func CompareRepositoryBindings(authoritative, fresh domain.RepositoryBinding) (RepositoryRelation, error) {
	if authoritative.Validate() != nil || fresh.Validate() != nil {
		return "", domain.ErrInvalidArgument
	}
	identity := authoritative.CanonicalRoot == fresh.CanonicalRoot &&
		authoritative.GitCommonDirDigest == fresh.GitCommonDirDigest &&
		authoritative.RepositoryIdentity == fresh.RepositoryIdentity &&
		sameText(authoritative.Branch, fresh.Branch) && authoritative.Detached == fresh.Detached &&
		sameText(authoritative.Head, fresh.Head) && authoritative.Unborn == fresh.Unborn
	if identity && authoritative.WorktreeFingerprint == fresh.WorktreeFingerprint && authoritative.BindingDigest == fresh.BindingDigest {
		return RepositoryExact, nil
	}
	if identity && authoritative.WorktreeFingerprint != fresh.WorktreeFingerprint && authoritative.BindingDigest != fresh.BindingDigest {
		return RepositoryWorktreeOnlyChanged, nil
	}
	return RepositoryForbiddenChange, nil
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
		workflow.ValidateOperationReference(input.Operation) != nil || input.Observed.Validate() != nil ||
		input.Task.OriginHost != input.Host || input.Task.Process != input.Operation.Process || len(input.Payload) == 0 {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	relation, err := CompareRepositoryBindings(input.Task.Repository, input.Observed)
	if err != nil {
		return RecoveryDecision{}, err
	}

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
				payload.Condition != input.Task.Blocker.Condition || payload.ObservedBindingDigest != input.Observed.BindingDigest {
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
			evidence = operationEvidenceFor(effect, relation, input.Task.Repository, input.Observed)
		}
	}

	lastRelation, proof := compareLastOperation(input.Task.LastOperation, input.Operation, payloadDigest, input.Task.Revision)
	facts := ClassificationFacts{
		Operation:                    input.Operation,
		TaskRevision:                 input.Task.Revision,
		CurrentNode:                  input.Task.CurrentNode,
		CurrentActionID:              currentActionID(input.Task.CurrentAction),
		IssuanceBindingDigest:        input.Operation.RepositoryBindingDigest,
		AuthoritativeBindingDigest:   input.Task.Repository.BindingDigest,
		ObservedBindingDigest:        input.Observed.BindingDigest,
		RepositoryRelation:           relation,
		LastOperationRelation:        lastRelation,
		OperationEvidence:            evidence,
		OperationPayloadDigest:       payloadDigest,
		CommittedProof:               proof,
		SourceCurrent:                sourceCurrent(input.Task, input.Operation),
		PayloadRetained:              payloadRetained,
		MayHavePartialRepositoryWork: mayHavePartialRepositoryWork(input.Operation, relation, input.Observed),
		ExistingBlocker:              input.Task.Blocker,
		ObservedAt:                   input.Observed.ObservedAt,
	}
	decision, err := Classify(facts)
	if err != nil {
		return RecoveryDecision{}, err
	}
	decision.CanonicalPayload = canonical
	return decision, nil
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
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged && matchesDeclaredDelta(authoritative.ChangedPaths, effect.ChangedPaths, observed.ChangedPaths)
	case EffectProductFileChange:
		if effect.NoFileChanges {
			return relation == RepositoryExact && len(effect.ChangedPaths) == 0
		}
		return relation == RepositoryWorktreeOnlyChanged && len(effect.ChangedPaths) > 0 && matchesDeclaredDelta(authoritative.ChangedPaths, effect.ChangedPaths, observed.ChangedPaths)
	default:
		return false
	}
}

func matchesDeclaredDelta(authoritative, declared, observed []string) bool {
	expected := make(map[string]struct{}, len(authoritative)+len(declared))
	for _, path := range authoritative {
		expected[path] = struct{}{}
	}
	for _, path := range declared {
		if _, exists := expected[path]; exists {
			return false
		}
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

func sourceCurrent(task domain.ProcessTask, operation domain.OperationReference) bool {
	return task.Revision == operation.ExpectedRevision && task.CurrentNode == operation.SourceCursor &&
		task.CurrentAction != nil && task.CurrentAction.ActionID == operation.ActionID &&
		task.CurrentAction.Kind == operation.ActionKind && task.CurrentAction.Process == operation.Process &&
		task.CurrentAction.NodeID == operation.SourceCursor &&
		task.CurrentAction.RepositoryBindingDigest == operation.RepositoryBindingDigest &&
		task.Repository.BindingDigest == operation.RepositoryBindingDigest
}

func mayHavePartialRepositoryWork(operation domain.OperationReference, relation RepositoryRelation, observed domain.RepositoryBinding) bool {
	return relation == RepositoryWorktreeOnlyChanged && len(observed.ChangedPaths) > 0 &&
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
