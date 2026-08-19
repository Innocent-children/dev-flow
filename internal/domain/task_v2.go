package domain

import "time"

type TaskIntent struct {
	Request                 string             `json:"request"`
	InitialScope            []string           `json:"initial_scope"`
	InitialOutOfScope       []string           `json:"initial_out_of_scope"`
	KnownAcceptanceCriteria []string           `json:"known_acceptance_criteria"`
	VerificationBudget      VerificationBudget `json:"verification_budget"`
	MethodProfile           MethodProfile      `json:"method_profile"`
}

func (i TaskIntent) Validate() error {
	if requireNormalizedText(i.Request, MaxGoalBytes, true) != nil || i.VerificationBudget.Validate() != nil || !i.MethodProfile.IsValid() {
		return ErrInvalidArgument
	}
	for _, list := range [][]string{i.InitialScope, i.InitialOutOfScope, i.KnownAcceptanceCriteria} {
		if validateNormalizedList(list) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

type TransitionProjection struct {
	TransitionID       TransitionID      `json:"transition_id"`
	Destination        NodeID            `json:"destination_node"`
	Guard              TransitionGuardID `json:"guard_id"`
	Description        string            `json:"description"`
	SelectionCondition string            `json:"selection_condition"`
	ReasonRequired     bool              `json:"reason_required"`
}
type NodeContractProjection struct {
	Purpose              string   `json:"purpose"`
	EntryConditions      []string `json:"entry_conditions"`
	CompletionConditions []string `json:"completion_conditions"`
}
type ProcessActionV2 struct {
	ActionID                ID                     `json:"action_id"`
	Kind                    ActionKind             `json:"kind"`
	TaskID                  ID                     `json:"task_id"`
	Revision                uint64                 `json:"revision"`
	Process                 ProcessReference       `json:"process"`
	NodeID                  NodeID                 `json:"current_node"`
	RepositoryBindingDigest Digest                 `json:"repository_binding_digest"`
	AllowedEffects          []AllowedEffect        `json:"allowed_effects"`
	RequiredEvidence        []EvidenceRequirement  `json:"required_evidence"`
	PayloadContract         string                 `json:"payload_contract"`
	NodeContract            NodeContractProjection `json:"node_contract"`
	AvailableTransitions    []TransitionProjection `json:"available_transitions"`
	MethodProfile           MethodProfile          `json:"method_profile"`
	SemanticMethodSteps     []SemanticMethodStep   `json:"method_steps"`
	Guidance                string                 `json:"guidance"`
	IssuedAt                time.Time              `json:"issued_at"`
}

func (a ProcessActionV2) Validate() error {
	if validateID(a.ActionID) != nil || validateID(a.TaskID) != nil || a.Revision == 0 || a.Process.Validate() != nil || !a.NodeID.IsValid() || !a.Kind.IsValidV2() || !a.RepositoryBindingDigest.IsValid() || !a.MethodProfile.IsValid() || validateUTC(a.IssuedAt) != nil || requireNormalizedText(a.PayloadContract, MaxIdentifierBytes, true) != nil || requireNormalizedText(a.Guidance, MaxGuidanceBytes, true) != nil || requireNormalizedText(a.NodeContract.Purpose, MaxGuidanceBytes, true) != nil || len(a.NodeContract.EntryConditions) == 0 || validateNormalizedList(a.NodeContract.EntryConditions) != nil || len(a.NodeContract.CompletionConditions) == 0 || validateNormalizedList(a.NodeContract.CompletionConditions) != nil || len(a.AllowedEffects) == 0 || len(a.RequiredEvidence) == 0 || len(a.SemanticMethodSteps) == 0 || len(a.AvailableTransitions) > MaxStandardProcessTransitions {
		return ErrInvalidArgument
	}
	seenEffects := map[AllowedEffect]bool{}
	for _, effect := range a.AllowedEffects {
		if !effect.IsValidV2() || seenEffects[effect] {
			return ErrInvalidArgument
		}
		seenEffects[effect] = true
	}
	seenEvidence := map[EvidenceRequirementKind]bool{}
	for _, requirement := range a.RequiredEvidence {
		if requirement.ValidateV2() != nil || seenEvidence[requirement.Kind] {
			return ErrInvalidArgument
		}
		seenEvidence[requirement.Kind] = true
	}
	seenTransitions := map[TransitionID]bool{}
	for _, transition := range a.AvailableTransitions {
		if !transition.TransitionID.IsValid() || !transition.Destination.IsValid() || !transition.Guard.IsValid() || requireNormalizedText(transition.Description, MaxGuidanceBytes, true) != nil || requireNormalizedText(transition.SelectionCondition, MaxGuidanceBytes, true) != nil || seenTransitions[transition.TransitionID] {
			return ErrInvalidArgument
		}
		seenTransitions[transition.TransitionID] = true
	}
	seenSteps := map[MethodStepID]bool{}
	for _, step := range a.SemanticMethodSteps {
		if step.Validate() != nil || seenSteps[step.StepID] {
			return ErrInvalidArgument
		}
		seenSteps[step.StepID] = true
	}
	return nil
}

type ProcessBlocker struct {
	BlockerID  ID     `json:"blocker_id"`
	ResumeNode NodeID `json:"resume_node"`
	Message    string `json:"message"`
}

func (b ProcessBlocker) Validate() error {
	if validateID(b.BlockerID) != nil || !b.ResumeNode.Normal() || requireNormalizedText(b.Message, MaxReasonBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
}

type ProcessOutcome struct {
	Status                TerminalStatus     `json:"status"`
	Summary               string             `json:"summary"`
	RequirementsRevision  uint32             `json:"requirements_revision"`
	Acceptance            []OutcomeCriterion `json:"acceptance"`
	TestRecordID          ID                 `json:"test_record_id"`
	ComprehensionRecordID ID                 `json:"comprehension_record_id"`
	AutomatedEvidenceIDs  []ID               `json:"automated_evidence_ids"`
	ManualEvidenceIDs     []ID               `json:"manual_evidence_ids"`
	FinalRepositoryDigest Digest             `json:"final_repository_digest"`
	Risks                 []string           `json:"risks"`
	CompletedAt           time.Time          `json:"completed_at"`
}

func (o ProcessOutcome) Validate() error {
	if !o.Status.IsValid() || requireNormalizedText(o.Summary, MaxOutcomeSummaryBytes, true) != nil || !o.FinalRepositoryDigest.IsValid() || validateUTC(o.CompletedAt) != nil || validateNormalizedList(o.Risks) != nil || len(o.AutomatedEvidenceIDs)+len(o.ManualEvidenceIDs) > MaxRetainedEvidenceItems {
		return ErrInvalidArgument
	}
	if o.Status == TerminalCompleted && (o.RequirementsRevision == 0 || len(o.Acceptance) == 0 || validateID(o.TestRecordID) != nil || validateID(o.ComprehensionRecordID) != nil) {
		return ErrInvalidArgument
	}
	for _, criterion := range o.Acceptance {
		if criterion.Validate() != nil {
			return ErrInvalidArgument
		}
	}
	seen := map[ID]bool{}
	for _, ids := range [][]ID{o.AutomatedEvidenceIDs, o.ManualEvidenceIDs} {
		for _, id := range ids {
			if validateID(id) != nil || seen[id] {
				return ErrInvalidArgument
			}
			seen[id] = true
		}
	}
	return nil
}

type ProcessTask struct {
	TaskID          ID                       `json:"task_id"`
	OriginHost      Host                     `json:"origin_host"`
	Intent          TaskIntent               `json:"intent"`
	Process         ProcessReference         `json:"process"`
	CurrentNode     NodeID                   `json:"current_node"`
	ResumeNode      *NodeID                  `json:"resume_node"`
	CurrentAction   *ProcessActionV2         `json:"current_action"`
	Blocker         *ProcessBlocker          `json:"blocker"`
	LastOperation   *LastOperation           `json:"last_operation"`
	Repository      RepositoryBinding        `json:"repository"`
	Requirements    *RequirementsBaseline    `json:"requirements"`
	Design          *DesignBaseline          `json:"design"`
	TaskPlan        *TaskPlanBaseline        `json:"task_plan"`
	Implementation  *ImplementationRecord    `json:"implementation"`
	Test            *TestRecord              `json:"test"`
	Comprehension   *ComprehensionAssessment `json:"comprehension"`
	BaselineHistory []BaselineReference      `json:"baseline_history"`
	Evidence        []EvidenceSummary        `json:"evidence"`
	Outcome         *ProcessOutcome          `json:"outcome"`
	Revision        uint64                   `json:"revision"`
	CreatedAt       time.Time                `json:"created_at"`
	UpdatedAt       time.Time                `json:"updated_at"`
	CompletedAt     *time.Time               `json:"completed_at"`
}

func (t ProcessTask) Validate() error {
	if validateID(t.TaskID) != nil || !t.OriginHost.IsValid() || t.Intent.Validate() != nil || t.Process.Validate() != nil || !t.CurrentNode.IsValid() || t.Repository.Validate() != nil || t.Revision == 0 || validateUTC(t.CreatedAt) != nil || validateUTC(t.UpdatedAt) != nil || t.UpdatedAt.Before(t.CreatedAt) || len(t.BaselineHistory) > MaxRetainedBaselineReferences || len(t.Evidence) > MaxRetainedEvidenceItems {
		return ErrInvalidArgument
	}
	if t.Requirements != nil && t.Requirements.Validate() != nil {
		return ErrInvalidArgument
	}
	if t.Design != nil && (t.Design.Validate() != nil || t.Requirements == nil || t.Design.RequirementsRevision != t.Requirements.Revision) {
		return ErrInvalidArgument
	}
	if t.TaskPlan != nil && (t.TaskPlan.Validate() != nil || t.Design == nil || t.TaskPlan.DesignRevision != t.Design.Revision) {
		return ErrInvalidArgument
	}
	if t.Implementation != nil && (t.Implementation.Validate() != nil || t.TaskPlan == nil || t.Implementation.TaskPlanRevision != t.TaskPlan.Revision || t.Implementation.RepositoryBindingDigest != t.Repository.BindingDigest) {
		return ErrInvalidArgument
	}
	if t.CurrentNode.Terminal() {
		if t.CurrentAction != nil || t.Blocker != nil || t.ResumeNode != nil || t.Outcome == nil || t.CompletedAt == nil {
			return ErrInvalidArgument
		}
		if t.Outcome.Validate() != nil || !t.CompletedAt.Equal(t.Outcome.CompletedAt) || (t.CurrentNode == NodeDone && t.Outcome.Status != TerminalCompleted) || (t.CurrentNode == NodeCancelled && t.Outcome.Status != TerminalCancelled) {
			return ErrInvalidArgument
		}
	} else if t.CurrentNode == NodeBlocked {
		if t.Blocker == nil || t.Blocker.Validate() != nil || t.ResumeNode == nil || !t.ResumeNode.Normal() || t.Blocker.ResumeNode != *t.ResumeNode || t.CurrentAction == nil || t.CurrentAction.Kind != ActionResolveBlocker {
			return ErrInvalidArgument
		}
	} else if !t.CurrentNode.Normal() || t.CurrentAction == nil || t.Blocker != nil || t.ResumeNode != nil || t.Outcome != nil || t.CompletedAt != nil {
		return ErrInvalidArgument
	}
	if t.CurrentAction != nil && (t.CurrentAction.Validate() != nil || t.CurrentAction.TaskID != t.TaskID || t.CurrentAction.Revision != t.Revision || t.CurrentAction.Process != t.Process || t.CurrentAction.NodeID != t.CurrentNode || t.CurrentAction.RepositoryBindingDigest != t.Repository.BindingDigest || t.CurrentAction.MethodProfile != t.Intent.MethodProfile) {
		return ErrInvalidArgument
	}
	if !authorityMatchesCurrentNode(t) {
		return ErrInvalidArgument
	}
	if t.LastOperation != nil && (t.LastOperation.Validate() != nil || t.LastOperation.ToRevision != t.Revision) {
		return ErrInvalidArgument
	}
	evidenceIDs := map[ID]bool{}
	evidenceByID := map[ID]EvidenceSummary{}
	for _, item := range t.Evidence {
		if item.Validate() != nil || evidenceIDs[item.EvidenceID] {
			return ErrInvalidArgument
		}
		evidenceIDs[item.EvidenceID] = true
		evidenceByID[item.EvidenceID] = item
	}
	if t.Test != nil && (t.Test.Validate() != nil || t.Requirements == nil || t.Design == nil || t.TaskPlan == nil || t.Test.RequirementsRevision != t.Requirements.Revision || t.Test.DesignRevision != t.Design.Revision || t.Test.TaskPlanRevision != t.TaskPlan.Revision || t.Test.RepositoryBindingDigest != t.Repository.BindingDigest) {
		return ErrInvalidArgument
	}
	if t.Test != nil {
		for _, id := range t.Test.EvidenceIDs {
			item, ok := evidenceByID[id]
			if !ok || item.Status != EvidencePassed {
				return ErrInvalidArgument
			}
		}
	}
	if t.TaskPlan != nil && !taskPlanAcceptanceIndexesValid(*t.TaskPlan, t.Requirements) {
		return ErrInvalidArgument
	}
	if t.Implementation != nil && !implementationWorkItemsValid(*t.Implementation, t.TaskPlan) {
		return ErrInvalidArgument
	}
	if t.Comprehension != nil && (t.Comprehension.Validate() != nil || t.Test == nil || t.Comprehension.TestRecordID != t.Test.RecordID || t.Comprehension.RequirementsRevision != t.Test.RequirementsRevision || t.Comprehension.DesignRevision != t.Test.DesignRevision || t.Comprehension.TaskPlanRevision != t.Test.TaskPlanRevision || t.Comprehension.RepositoryBindingDigest != t.Test.RepositoryBindingDigest) {
		return ErrInvalidArgument
	}
	if t.Comprehension != nil {
		item, ok := evidenceByID[t.Comprehension.UserEvidenceID]
		if !ok || item.Source != EvidenceSourceUser || item.Status != EvidencePassed || !item.RecordedAt.Equal(t.Comprehension.ConfirmedAt) {
			return ErrInvalidArgument
		}
	}
	if t.Outcome != nil && t.Outcome.Status == TerminalCompleted && !completedOutcomeMatchesTask(t, evidenceByID) {
		return ErrInvalidArgument
	}
	history := map[BaselineKind]map[uint32]bool{}
	for _, ref := range t.BaselineHistory {
		if history[ref.Kind] == nil {
			history[ref.Kind] = map[uint32]bool{}
		}
		if history[ref.Kind][ref.Revision] || !baselineReferencePrecedesCurrent(ref, t) {
			return ErrInvalidArgument
		}
		history[ref.Kind][ref.Revision] = true
	}
	for _, ref := range t.BaselineHistory {
		if ref.Validate() != nil {
			return ErrInvalidArgument
		}
	}
	if !baselineRevisionChainsValid(t, history) {
		return ErrInvalidArgument
	}
	if size, err := compactJSONSize(t); err != nil || size > MaxPersistedTaskSnapshotBytes {
		return ErrInvalidArgument
	}
	return nil
}

func authorityMatchesCurrentNode(t ProcessTask) bool {
	node := t.CurrentNode
	if node == NodeBlocked {
		if t.ResumeNode == nil {
			return false
		}
		node = *t.ResumeNode
	}
	switch node {
	case NodeRequirements:
		return t.Design == nil && t.TaskPlan == nil && t.Implementation == nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeDesign:
		return t.Requirements != nil && t.TaskPlan == nil && t.Implementation == nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeTasks:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan == nil && t.Implementation == nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeImplement:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeTest:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Implementation != nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeComprehensionReview:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Implementation != nil && t.Test != nil && t.Comprehension == nil && t.Outcome == nil
	case NodeRefactor:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Implementation != nil && t.Test == nil && t.Comprehension == nil && t.Outcome == nil
	case NodeDelivery:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Implementation != nil && t.Test != nil && t.Comprehension != nil && t.Outcome == nil
	case NodeDone:
		return t.Requirements != nil && t.Design != nil && t.TaskPlan != nil && t.Implementation != nil && t.Test != nil && t.Comprehension != nil && t.Outcome != nil && t.Outcome.Status == TerminalCompleted && t.CompletedAt != nil
	case NodeCancelled:
		return t.Outcome != nil && t.Outcome.Status == TerminalCancelled && t.CompletedAt != nil
	default:
		return false
	}
}

func taskPlanAcceptanceIndexesValid(plan TaskPlanBaseline, requirements *RequirementsBaseline) bool {
	if requirements == nil {
		return false
	}
	for _, item := range plan.WorkItems {
		for _, index := range item.AcceptanceIndexes {
			if int(index) >= len(requirements.AcceptanceCriteria) {
				return false
			}
		}
	}
	return true
}

func implementationWorkItemsValid(implementation ImplementationRecord, plan *TaskPlanBaseline) bool {
	if plan == nil {
		return false
	}
	known := make(map[ID]bool, len(plan.WorkItems))
	for _, item := range plan.WorkItems {
		known[item.WorkItemID] = true
	}
	for _, id := range implementation.CompletedWorkItemIDs {
		if !known[id] {
			return false
		}
	}
	return true
}

func baselineRevisionChainsValid(t ProcessTask, history map[BaselineKind]map[uint32]bool) bool {
	current := map[BaselineKind]uint32{}
	if t.Requirements != nil {
		current[BaselineRequirements] = t.Requirements.Revision
	}
	if t.Design != nil {
		current[BaselineDesign] = t.Design.Revision
	}
	if t.TaskPlan != nil {
		current[BaselineTaskPlan] = t.TaskPlan.Revision
	}
	for _, kind := range []BaselineKind{BaselineRequirements, BaselineDesign, BaselineTaskPlan} {
		revisions := history[kind]
		for revision := uint32(1); revision <= uint32(len(revisions)); revision++ {
			if !revisions[revision] {
				return false
			}
		}
		if revision := current[kind]; revision != 0 && revision != uint32(len(revisions))+1 {
			return false
		}
	}
	return true
}

func completedOutcomeMatchesTask(t ProcessTask, evidence map[ID]EvidenceSummary) bool {
	if t.Requirements == nil || t.Design == nil || t.TaskPlan == nil || t.Implementation == nil || t.Test == nil || t.Comprehension == nil ||
		t.Outcome.RequirementsRevision != t.Requirements.Revision || t.Outcome.TestRecordID != t.Test.RecordID ||
		t.Outcome.ComprehensionRecordID != t.Comprehension.RecordID || t.Outcome.FinalRepositoryDigest != t.Repository.BindingDigest ||
		len(t.Test.UnverifiedItems) != 0 || len(t.Test.ManualHandoffItems) != 0 || len(t.Outcome.Acceptance) != len(t.Requirements.AcceptanceCriteria) {
		return false
	}
	for i, criterion := range t.Outcome.Acceptance {
		if criterion.Criterion != t.Requirements.AcceptanceCriteria[i] || criterion.Status != CriterionSatisfied {
			return false
		}
	}
	expectedAutomated := []ID{}
	expectedManual := []ID{}
	for _, id := range t.Test.EvidenceIDs {
		item, ok := evidence[id]
		if !ok || item.Status != EvidencePassed {
			return false
		}
		switch item.Source {
		case EvidenceSourceAutomated:
			expectedAutomated = append(expectedAutomated, id)
		case EvidenceSourceUser:
			expectedManual = append(expectedManual, id)
		case EvidenceSourceStatic, EvidenceSourceHostObserved:
		default:
			return false
		}
	}
	confirmation, ok := evidence[t.Comprehension.UserEvidenceID]
	if !ok || confirmation.Source != EvidenceSourceUser || confirmation.Status != EvidencePassed {
		return false
	}
	expectedManual = append(expectedManual, t.Comprehension.UserEvidenceID)
	return sameIDs(t.Outcome.AutomatedEvidenceIDs, expectedAutomated) && sameIDs(t.Outcome.ManualEvidenceIDs, expectedManual)
}

func sameIDs(actual, expected []ID) bool {
	if len(actual) != len(expected) {
		return false
	}
	for i := range actual {
		if actual[i] != expected[i] {
			return false
		}
	}
	return true
}

func baselineReferencePrecedesCurrent(ref BaselineReference, t ProcessTask) bool {
	switch ref.Kind {
	case BaselineRequirements:
		return t.Requirements == nil || ref.Revision < t.Requirements.Revision
	case BaselineDesign:
		return t.Design == nil || ref.Revision < t.Design.Revision
	case BaselineTaskPlan:
		return t.TaskPlan == nil || ref.Revision < t.TaskPlan.Revision
	default:
		return false
	}
}

func (t *ProcessTask) InvalidateForDestination(destination NodeID) {
	switch destination {
	case NodeRequirements:
		t.Design = nil
		t.TaskPlan = nil
		t.Implementation = nil
		t.Test = nil
		t.Comprehension = nil
	case NodeDesign:
		t.TaskPlan = nil
		t.Implementation = nil
		t.Test = nil
		t.Comprehension = nil
	case NodeTasks:
		t.Implementation = nil
		t.Test = nil
		t.Comprehension = nil
	case NodeImplement, NodeTest, NodeRefactor:
		t.Test = nil
		t.Comprehension = nil
	case NodeComprehensionReview:
		t.Comprehension = nil
	}
}
