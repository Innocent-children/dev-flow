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
			return domain.ErrInvalidArgument
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
			return domain.ErrInvalidArgument
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

func applyImplementationResult(task *domain.ProcessTask, transition domain.TransitionDefinition, envelope workflow.StandardPayload, result *workflow.ImplementationResult, fresh domain.RepositoryBinding, relation recovery.RepositoryRelation, now time.Time) error {
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
			return domain.ErrInvalidArgument
		}
	} else if len(result.Findings) == 0 {
		return domain.ErrInvalidArgument
	}
	revision := uint32(1)
	if task.Implementation != nil {
		revision = task.Implementation.Revision + 1
	}
	record := domain.ImplementationRecord{Revision: revision, TaskPlanRevision: result.TaskPlanRevision, RepositoryBindingDigest: fresh.BindingDigest, CompletedWorkItemIDs: result.CompletedWorkItemIDs, ChangedPaths: result.ChangedPaths, NoFileChanges: result.NoFileChanges, Deviations: result.Deviations, Summary: envelope.Summary, CreatedAt: now}
	if record.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	task.Repository, task.Implementation = fresh, &record
	return invalidateForDestination(task, transition.Destination)
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
