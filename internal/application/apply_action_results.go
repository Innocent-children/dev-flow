package application

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func applyRequirementsResult(task *domain.ProcessTask, envelope workflow.StandardPayload, result *workflow.RequirementsResult, now time.Time) error {
	if envelope.TransitionID != "requirements_ready" || result.Baseline == nil {
		return domain.ErrTransitionNotAllowed
	}
	revision := nextBaselineRevision(task, domain.BaselineRequirements)
	digest, err := requirementsDigest(*result.Baseline, envelope.Artifacts)
	if err != nil {
		return err
	}
	baseline := domain.RequirementsBaseline{Revision: revision, Digest: digest, Goal: result.Baseline.Goal, Scope: result.Baseline.Scope, OutOfScope: result.Baseline.OutOfScope, AcceptanceCriteria: result.Baseline.AcceptanceCriteria, Constraints: result.Baseline.Constraints, Assumptions: result.Baseline.Assumptions, ArtifactRefs: envelope.Artifacts, CreatedAt: now}
	if baseline.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	if task.Requirements != nil {
		if err := appendBaselineHistory(task, domain.BaselineReference{Kind: domain.BaselineRequirements, Revision: task.Requirements.Revision, Digest: task.Requirements.Digest, Summary: task.Requirements.Goal, CreatedAt: task.Requirements.CreatedAt}); err != nil {
			return err
		}
	}
	if err := invalidateForDestination(task, domain.NodeRequirements); err != nil {
		return err
	}
	task.Requirements = &baseline
	return nil
}

func applyDesignResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.DesignResult, now time.Time) error {
	if transition.TransitionID != "design_ready" {
		if len(result.Findings) == 0 {
			return domain.ErrTransitionNotAllowed
		}
		return invalidateForDestination(task, transition.Destination)
	}
	if task.Requirements == nil || result.Baseline == nil || result.Baseline.RequirementsRevision != task.Requirements.Revision {
		return domain.ErrInvalidArgument
	}
	revision := nextBaselineRevision(task, domain.BaselineDesign)
	digest, err := designDigest(*result.Baseline, envelope.Artifacts)
	if err != nil {
		return err
	}
	baseline := domain.DesignBaseline{Revision: revision, Digest: digest, RequirementsRevision: result.Baseline.RequirementsRevision, Approach: result.Baseline.Approach, Components: result.Baseline.Components, Decisions: result.Baseline.Decisions, RejectedAlternatives: result.Baseline.RejectedAlternatives, ComplexityJustification: result.Baseline.ComplexityJustification, Risks: result.Baseline.Risks, ArtifactRefs: envelope.Artifacts, CreatedAt: now}
	if baseline.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	if task.Design != nil {
		if err := appendBaselineHistory(task, domain.BaselineReference{Kind: domain.BaselineDesign, Revision: task.Design.Revision, Digest: task.Design.Digest, Summary: task.Design.Approach, CreatedAt: task.Design.CreatedAt}); err != nil {
			return err
		}
	}
	if err := invalidateForDestination(task, domain.NodeDesign); err != nil {
		return err
	}
	task.Design = &baseline
	return nil
}

func applyTaskPlanResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.TasksResult, now time.Time) error {
	if transition.TransitionID != "tasks_ready" {
		if len(result.Findings) == 0 {
			return domain.ErrTransitionNotAllowed
		}
		return invalidateForDestination(task, transition.Destination)
	}
	if task.Requirements == nil || task.Design == nil || result.Baseline == nil || result.Baseline.DesignRevision != task.Design.Revision {
		return domain.ErrInvalidArgument
	}
	revision := nextBaselineRevision(task, domain.BaselineTaskPlan)
	digest, err := taskPlanDigest(*result.Baseline, envelope.Artifacts)
	if err != nil {
		return err
	}
	baseline := domain.TaskPlanBaseline{Revision: revision, Digest: digest, DesignRevision: result.Baseline.DesignRevision, WorkItems: result.Baseline.WorkItems, ArtifactRefs: envelope.Artifacts, CreatedAt: now}
	if baseline.Validate() != nil || !acceptanceCovered(baseline.WorkItems, len(task.Requirements.AcceptanceCriteria)) {
		return domain.ErrInvalidArgument
	}
	for _, item := range baseline.WorkItems {
		if len(item.VerificationSteps) == 0 {
			return domain.ErrInvalidArgument
		}
		for _, index := range item.AcceptanceIndexes {
			if int(index) >= len(task.Requirements.AcceptanceCriteria) {
				return domain.ErrInvalidArgument
			}
		}
	}
	if task.TaskPlan != nil {
		if err := appendBaselineHistory(task, taskPlanReference(*task.TaskPlan)); err != nil {
			return err
		}
	}
	task.Implementation, task.Test, task.Comprehension = nil, nil, nil
	task.TaskPlan = &baseline
	return nil
}

func applyImplementationResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.ImplementationResult, fresh recovery.RepositoryScopeObservation, relation recovery.RepositoryRelation, now time.Time) error {
	if task.TaskPlan == nil || result.TaskPlanRevision != task.TaskPlan.Revision {
		return domain.ErrInvalidArgument
	}
	if result.NoFileChanges != (relation == recovery.RepositoryExact) || (len(result.ChangedPaths) > 0) != (relation == recovery.RepositoryWorktreeOnlyChanged) {
		return domain.ErrRepositoryDrift
	}
	known := make(map[domain.ID]bool, len(task.TaskPlan.WorkItems))
	for _, item := range task.TaskPlan.WorkItems {
		known[item.WorkItemID] = true
	}
	for _, id := range result.CompletedWorkItemIDs {
		if !known[id] {
			return domain.ErrInvalidArgument
		}
	}
	if transition.TransitionID == "implementation_ready_for_test" {
		if len(result.Findings) != 0 {
			return domain.ErrTransitionNotAllowed
		}
	} else if len(result.Findings) == 0 {
		return domain.ErrTransitionNotAllowed
	}
	revision := uint32(1)
	if task.Implementation != nil {
		revision = task.Implementation.Revision + 1
	}
	rebindTaskRepositories(task, fresh)
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInvalidArgument
	}
	record := domain.ImplementationRecord{Revision: revision, TaskPlanRevision: result.TaskPlanRevision, RepositoryBindingDigest: effectiveDigest, CompletedWorkItemIDs: result.CompletedWorkItemIDs, ChangedPaths: result.ChangedPaths, NoFileChanges: result.NoFileChanges, Deviations: result.Deviations, Summary: envelope.Summary, CreatedAt: now}
	if record.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	task.Implementation = &record
	return invalidateForDestination(task, transition.Destination)
}

func (s *Service) applyTestResult(task *domain.ProcessTask, transition domain.TransitionDefinition, result *workflow.TestResult, now time.Time) error {
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInvalidArgument
	}
	if task.Requirements == nil || task.Design == nil || task.TaskPlan == nil || task.Implementation == nil || task.Implementation.TaskPlanRevision != task.TaskPlan.Revision || task.Implementation.RepositoryBindingDigest != effectiveDigest {
		return domain.ErrTransitionNotAllowed
	}
	if err := workflow.EvaluateVerificationBudget(task.Intent.VerificationBudget, task.Evidence, result.Checks, result.ManualHandoffItems); err != nil {
		return err
	}
	passing := transition.TransitionID == "tests_passed"
	if passing {
		if len(result.Checks) == 0 || len(result.FailedItems) != 0 || len(result.Findings) != 0 {
			return domain.ErrTransitionNotAllowed
		}
		for _, check := range result.Checks {
			if check.Status != domain.EvidencePassed {
				return domain.ErrTransitionNotAllowed
			}
		}
	} else if !testFailureFactsPresent(result) {
		return domain.ErrTransitionNotAllowed
	}
	evidence, err := s.buildEvidence(result.Checks, now)
	if err != nil {
		return err
	}
	task.Evidence = append(task.Evidence, evidence...)
	if !passing {
		task.Test = nil
		return invalidateForDestination(task, transition.Destination)
	}
	recordID, err := s.id("test")
	if err != nil {
		return err
	}
	ids := make([]domain.ID, len(evidence))
	for i := range evidence {
		ids[i] = evidence[i].EvidenceID
	}
	task.Test = &domain.TestRecord{RecordID: recordID, RequirementsRevision: task.Requirements.Revision, DesignRevision: task.Design.Revision, TaskPlanRevision: task.TaskPlan.Revision, RepositoryBindingDigest: effectiveDigest, EvidenceIDs: ids, UnverifiedItems: result.UnverifiedItems, ManualHandoffItems: result.ManualHandoffItems, PassedAt: now}
	task.Comprehension = nil
	return nil
}

func testFailureFactsPresent(result *workflow.TestResult) bool {
	if len(result.FailedItems) != 0 || len(result.Findings) != 0 {
		return true
	}
	for _, check := range result.Checks {
		if check.Status == domain.EvidenceFailed {
			return true
		}
	}
	return false
}

func (s *Service) applyComprehensionResult(task *domain.ProcessTask, transition domain.TransitionDefinition, result *workflow.ComprehensionResult, now time.Time) error {
	if task.Requirements == nil || task.Design == nil || task.TaskPlan == nil || task.Implementation == nil || task.Test == nil {
		return domain.ErrTransitionNotAllowed
	}
	if transition.TransitionID != "comprehension_passed" {
		if result.UserConfirmation != nil || !comprehensionFailureFactsPresent(transition.TransitionID, result) {
			return domain.ErrTransitionNotAllowed
		}
		task.Comprehension = nil
		return invalidateForDestination(task, transition.Destination)
	}
	confirmation := result.UserConfirmation
	if confirmation == nil || confirmation.Source != domain.EvidenceSourceUser || confirmation.Status != domain.EvidencePassed || len(result.ExplainedComponents) == 0 || len(result.UnresolvedQuestions) != 0 || len(result.UnnecessaryAbstractions) != 0 || len(result.Findings) != 0 {
		return domain.ErrTransitionNotAllowed
	}
	input := workflow.EvidenceInput{Source: confirmation.Source, Name: "comprehension_confirmation", Status: confirmation.Status, Summary: confirmation.Summary}
	if err := workflow.ValidateComprehensionConfirmation(task.Evidence, input); err != nil {
		return err
	}
	evidence, err := s.buildEvidence([]workflow.EvidenceInput{input}, now)
	if err != nil {
		return err
	}
	recordID, err := s.id("comprehension")
	if err != nil {
		return err
	}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInvalidArgument
	}
	task.Evidence = append(task.Evidence, evidence[0])
	task.Comprehension = &domain.ComprehensionAssessment{RecordID: recordID, TestRecordID: task.Test.RecordID, RequirementsRevision: task.Requirements.Revision, DesignRevision: task.Design.Revision, TaskPlanRevision: task.TaskPlan.Revision, RepositoryBindingDigest: effectiveDigest, ExplainedComponents: result.ExplainedComponents, MaintenanceRisks: result.MaintenanceRisks, UserEvidenceID: evidence[0].EvidenceID, ConfirmedAt: now}
	return nil
}

func comprehensionFailureFactsPresent(transition domain.TransitionID, result *workflow.ComprehensionResult) bool {
	switch transition {
	case "code_too_complex", "design_too_complex":
		return len(result.UnnecessaryAbstractions) != 0 || len(result.Findings) != 0 || len(result.MaintenanceRisks) != 0
	case "evidence_insufficient", "requirement_unclear":
		return len(result.UnresolvedQuestions) != 0 || len(result.Findings) != 0
	case "implementation_defect":
		return len(result.Findings) != 0
	default:
		return false
	}
}

func applyRefactorResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.RefactorResult, fresh recovery.RepositoryScopeObservation, relation recovery.RepositoryRelation, now time.Time) error {
	if task.Requirements == nil || task.Design == nil || task.TaskPlan == nil || task.Implementation == nil {
		return domain.ErrTransitionNotAllowed
	}
	if result.NoFileChanges != (relation == recovery.RepositoryExact) || (len(result.ChangedPaths) > 0) != (relation == recovery.RepositoryWorktreeOnlyChanged) {
		return domain.ErrRepositoryDrift
	}
	if transition.TransitionID != "refactor_ready_for_test" {
		if len(result.Findings) == 0 {
			return domain.ErrTransitionNotAllowed
		}
		rebindProcessAuthorities(task, fresh)
		return invalidateForDestination(task, transition.Destination)
	}
	if len(result.Simplifications) == 0 || result.BehaviorChangeIntended || len(result.Findings) != 0 {
		return domain.ErrTransitionNotAllowed
	}
	previous := task.Implementation
	rebindTaskRepositories(task, fresh)
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInvalidArgument
	}
	record := domain.ImplementationRecord{Revision: previous.Revision + 1, TaskPlanRevision: task.TaskPlan.Revision, RepositoryBindingDigest: effectiveDigest, CompletedWorkItemIDs: previous.CompletedWorkItemIDs, ChangedPaths: result.ChangedPaths, NoFileChanges: result.NoFileChanges, Deviations: previous.Deviations, Summary: envelope.Summary, CreatedAt: now}
	if record.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	task.Implementation = &record
	return invalidateForDestination(task, domain.NodeTest)
}

func applyDeliveryResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.DeliveryResult, now time.Time) error {
	if transition.TransitionID != "delivery_complete" {
		if len(result.Findings) == 0 || len(result.Acceptance) != 0 || len(result.AutomatedEvidenceIDs) != 0 || len(result.ManualEvidenceIDs) != 0 || result.TestRecordID != "" || result.ComprehensionRecordID != "" {
			return domain.ErrTransitionNotAllowed
		}
		return invalidateForDestination(task, transition.Destination)
	}
	if task.Requirements == nil || task.Design == nil || task.TaskPlan == nil || task.Implementation == nil || task.Test == nil || task.Comprehension == nil || len(task.Test.UnverifiedItems) != 0 || len(task.Test.ManualHandoffItems) != 0 || len(result.UnverifiedItems) != 0 || len(result.Findings) != 0 || result.TestRecordID != task.Test.RecordID || result.ComprehensionRecordID != task.Comprehension.RecordID || len(result.Acceptance) != len(task.Requirements.AcceptanceCriteria) {
		return domain.ErrTransitionNotAllowed
	}
	for i, criterion := range result.Acceptance {
		if criterion.Criterion != task.Requirements.AcceptanceCriteria[i] || criterion.Status != domain.CriterionSatisfied {
			return domain.ErrTransitionNotAllowed
		}
	}
	if !deliveryEvidenceCurrent(task, result.AutomatedEvidenceIDs, result.ManualEvidenceIDs) {
		return domain.ErrTransitionNotAllowed
	}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInvalidArgument
	}
	outcome := domain.ProcessOutcome{Status: domain.TerminalCompleted, Summary: envelope.Summary, RequirementsRevision: task.Requirements.Revision, Acceptance: result.Acceptance, TestRecordID: result.TestRecordID, ComprehensionRecordID: result.ComprehensionRecordID, AutomatedEvidenceIDs: result.AutomatedEvidenceIDs, ManualEvidenceIDs: result.ManualEvidenceIDs, FinalRepositoryDigest: effectiveDigest, Risks: result.Risks, CompletedAt: now}
	if outcome.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	task.Outcome, task.CompletedAt = &outcome, &now
	return nil
}

func deliveryEvidenceCurrent(task *domain.ProcessTask, automated, manual []domain.ID) bool {
	byID := map[domain.ID]domain.EvidenceSummary{}
	for _, item := range task.Evidence {
		byID[item.EvidenceID] = item
	}
	expectedAutomated := []domain.ID{}
	expectedManual := []domain.ID{}
	for _, id := range task.Test.EvidenceIDs {
		item, ok := byID[id]
		if !ok || item.Status != domain.EvidencePassed {
			return false
		}
		switch item.Source {
		case domain.EvidenceSourceAutomated:
			expectedAutomated = append(expectedAutomated, id)
		case domain.EvidenceSourceUser:
			expectedManual = append(expectedManual, id)
		case domain.EvidenceSourceStatic, domain.EvidenceSourceHostObserved:
		default:
			return false
		}
	}
	confirmation, ok := byID[task.Comprehension.UserEvidenceID]
	if !ok || confirmation.Source != domain.EvidenceSourceUser || confirmation.Status != domain.EvidencePassed {
		return false
	}
	expectedManual = append(expectedManual, task.Comprehension.UserEvidenceID)
	return sameEvidenceIDs(automated, expectedAutomated) && sameEvidenceIDs(manual, expectedManual)
}

func sameEvidenceIDs(actual, expected []domain.ID) bool {
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

func (s *Service) buildEvidence(inputs []workflow.EvidenceInput, now time.Time) ([]domain.EvidenceSummary, error) {
	items := make([]domain.EvidenceSummary, len(inputs))
	for i, input := range inputs {
		id, err := s.id("evidence")
		if err != nil {
			return nil, err
		}
		digest, err := digestCanonical(input)
		if err != nil {
			return nil, domain.ErrInternal
		}
		items[i] = domain.EvidenceSummary{EvidenceID: id, Source: input.Source, Name: input.Name, Status: input.Status, Summary: input.Summary, Digest: digest, CommandCount: input.CommandCount, FullSuite: input.FullSuite, RecordedAt: now}
		if items[i].Validate() != nil {
			return nil, domain.ErrInvalidArgument
		}
	}
	return items, nil
}

func invalidateForDestination(task *domain.ProcessTask, destination domain.NodeID) error {
	if destination == domain.NodeRequirements {
		if task.Design != nil {
			if err := appendBaselineHistory(task, domain.BaselineReference{Kind: domain.BaselineDesign, Revision: task.Design.Revision, Digest: task.Design.Digest, Summary: task.Design.Approach, CreatedAt: task.Design.CreatedAt}); err != nil {
				return err
			}
		}
		if task.TaskPlan != nil {
			if err := appendBaselineHistory(task, taskPlanReference(*task.TaskPlan)); err != nil {
				return err
			}
		}
	} else if destination == domain.NodeDesign && task.TaskPlan != nil {
		if err := appendBaselineHistory(task, taskPlanReference(*task.TaskPlan)); err != nil {
			return err
		}
	}
	task.InvalidateForDestination(destination)
	return nil
}

func taskPlanReference(plan domain.TaskPlanBaseline) domain.BaselineReference {
	return domain.BaselineReference{Kind: domain.BaselineTaskPlan, Revision: plan.Revision, Digest: plan.Digest, Summary: plan.WorkItems[0].Summary, CreatedAt: plan.CreatedAt}
}

func appendBaselineHistory(task *domain.ProcessTask, ref domain.BaselineReference) error {
	if ref.Validate() != nil || len(task.BaselineHistory) >= domain.MaxRetainedBaselineReferences {
		return domain.ErrInvalidArgument
	}
	for _, existing := range task.BaselineHistory {
		if existing.Kind == ref.Kind && existing.Revision == ref.Revision {
			return nil
		}
	}
	task.BaselineHistory = append(task.BaselineHistory, ref)
	return nil
}

func nextBaselineRevision(task *domain.ProcessTask, kind domain.BaselineKind) uint32 {
	var highest uint32
	for _, ref := range task.BaselineHistory {
		if ref.Kind == kind && ref.Revision > highest {
			highest = ref.Revision
		}
	}
	switch kind {
	case domain.BaselineRequirements:
		if task.Requirements != nil && task.Requirements.Revision > highest {
			highest = task.Requirements.Revision
		}
	case domain.BaselineDesign:
		if task.Design != nil && task.Design.Revision > highest {
			highest = task.Design.Revision
		}
	case domain.BaselineTaskPlan:
		if task.TaskPlan != nil && task.TaskPlan.Revision > highest {
			highest = task.TaskPlan.Revision
		}
	}
	return highest + 1
}

func acceptanceCovered(items []domain.WorkItem, count int) bool {
	covered := make([]bool, count)
	for _, item := range items {
		for _, index := range item.AcceptanceIndexes {
			if int(index) < count {
				covered[index] = true
			}
		}
	}
	for _, value := range covered {
		if !value {
			return false
		}
	}
	return count > 0
}

func requirementsDigest(input workflow.RequirementsBaselineInput, artifacts []domain.ArtifactReference) (domain.Digest, error) {
	return digestCanonical(struct {
		Goal               string                     `json:"goal"`
		Scope              []string                   `json:"scope"`
		OutOfScope         []string                   `json:"out_of_scope"`
		AcceptanceCriteria []string                   `json:"acceptance_criteria"`
		Constraints        []string                   `json:"constraints"`
		Assumptions        []string                   `json:"assumptions"`
		ArtifactRefs       []domain.ArtifactReference `json:"artifact_refs"`
	}{input.Goal, input.Scope, input.OutOfScope, input.AcceptanceCriteria, input.Constraints, input.Assumptions, artifacts})
}

func designDigest(input workflow.DesignBaselineInput, artifacts []domain.ArtifactReference) (domain.Digest, error) {
	return digestCanonical(struct {
		RequirementsRevision    uint32                     `json:"requirements_revision"`
		Approach                string                     `json:"approach"`
		Components              []string                   `json:"components"`
		Decisions               []string                   `json:"decisions"`
		RejectedAlternatives    []string                   `json:"rejected_alternatives"`
		ComplexityJustification []string                   `json:"complexity_justification"`
		Risks                   []string                   `json:"risks"`
		ArtifactRefs            []domain.ArtifactReference `json:"artifact_refs"`
	}{input.RequirementsRevision, input.Approach, input.Components, input.Decisions, input.RejectedAlternatives, input.ComplexityJustification, input.Risks, artifacts})
}

func taskPlanDigest(input workflow.TasksBaselineInput, artifacts []domain.ArtifactReference) (domain.Digest, error) {
	return digestCanonical(struct {
		DesignRevision uint32                     `json:"design_revision"`
		WorkItems      []domain.WorkItem          `json:"work_items"`
		ArtifactRefs   []domain.ArtifactReference `json:"artifact_refs"`
	}{input.DesignRevision, input.WorkItems, artifacts})
}
