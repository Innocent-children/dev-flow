package workflow

import (
	"github.com/Innocent-children/dev-flow/internal/domain"
	"strings"
)

type nodeSpec struct {
	id                                                  domain.NodeID
	purpose                                             string
	entry, complete, effects, evidence, steps, outgoing []string
	action                                              domain.ActionKind
	payload                                             string
}

func tr(id string, source, destination domain.NodeID, guard string, reason bool) domain.TransitionDefinition {
	return domain.TransitionDefinition{TransitionID: domain.TransitionID(id), Source: source, Destination: destination, Guard: domain.TransitionGuardID(guard), Description: "Move from " + string(source) + " to " + string(destination) + " after completing the declared node obligations.", SelectionCondition: "Choose this transition only when the " + humanize(guard) + " condition is satisfied.", ReasonRequired: reason}
}
func humanize(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "_", " "), ".", " ")
}

var standardTransitions = []domain.TransitionDefinition{
	tr("requirements_ready", domain.NodeRequirements, domain.NodeDesign, "requirements_baseline_complete", false),
	tr("design_ready", domain.NodeDesign, domain.NodeTasks, "design_baseline_complete", false), tr("design_requires_requirements", domain.NodeDesign, domain.NodeRequirements, "material_requirement_gap", true),
	tr("tasks_ready", domain.NodeTasks, domain.NodeImplement, "task_plan_baseline_complete", false), tr("tasks_require_design", domain.NodeTasks, domain.NodeDesign, "design_not_decomposable", true), tr("tasks_require_requirements", domain.NodeTasks, domain.NodeRequirements, "material_requirement_gap", true),
	tr("implementation_ready_for_test", domain.NodeImplement, domain.NodeTest, "implementation_report_complete", false), tr("implementation_requires_design", domain.NodeImplement, domain.NodeDesign, "implementation_exposes_design_gap", true), tr("implementation_requires_requirements", domain.NodeImplement, domain.NodeRequirements, "material_requirement_gap", true), tr("implementation_needs_refactor", domain.NodeImplement, domain.NodeRefactor, "implementation_complexity_identified", true),
	tr("tests_passed", domain.NodeTest, domain.NodeComprehensionReview, "current_tests_pass", false), tr("tests_failed_implementation", domain.NodeTest, domain.NodeImplement, "implementation_failure_identified", true), tr("tests_expose_design_issue", domain.NodeTest, domain.NodeDesign, "test_design_failure_identified", true), tr("tests_expose_requirement_issue", domain.NodeTest, domain.NodeRequirements, "test_requirement_gap_identified", true),
	tr("comprehension_passed", domain.NodeComprehensionReview, domain.NodeDelivery, "current_user_comprehension_confirmed", false), tr("implementation_defect", domain.NodeComprehensionReview, domain.NodeImplement, "implementation_defect_identified", true), tr("code_too_complex", domain.NodeComprehensionReview, domain.NodeRefactor, "code_complexity_identified", true), tr("design_too_complex", domain.NodeComprehensionReview, domain.NodeDesign, "design_complexity_identified", true), tr("evidence_insufficient", domain.NodeComprehensionReview, domain.NodeTest, "verification_gap_identified", true), tr("requirement_unclear", domain.NodeComprehensionReview, domain.NodeRequirements, "comprehension_requirement_gap_identified", true),
	tr("refactor_ready_for_test", domain.NodeRefactor, domain.NodeTest, "refactor_report_complete", false), tr("refactor_requires_design", domain.NodeRefactor, domain.NodeDesign, "refactor_design_change_required", true), tr("refactor_requires_requirements", domain.NodeRefactor, domain.NodeRequirements, "refactor_requirement_change_required", true),
	tr("delivery_complete", domain.NodeDelivery, domain.NodeDone, "delivery_current_and_complete", false), tr("delivery_needs_implementation", domain.NodeDelivery, domain.NodeImplement, "delivery_implementation_gap_identified", true), tr("delivery_needs_test", domain.NodeDelivery, domain.NodeTest, "delivery_test_gap_identified", true), tr("delivery_needs_comprehension", domain.NodeDelivery, domain.NodeComprehensionReview, "delivery_comprehension_gap_identified", true), tr("delivery_needs_design", domain.NodeDelivery, domain.NodeDesign, "delivery_design_gap_identified", true), tr("delivery_needs_requirements", domain.NodeDelivery, domain.NodeRequirements, "delivery_requirement_gap_identified", true),
}

var specs = []nodeSpec{
	{domain.NodeRequirements, "Transform the immutable initial intent into the current requirements authority.", []string{"intent_available", "repository_claimed", "requirements_context_available"}, []string{"requirements_goal_defined", "requirements_scope_bounded", "requirements_exclusions_explicit", "requirements_acceptance_nonempty", "requirements_material_questions_resolved", "requirements_user_decisions_recorded"}, []string{"read_repository", "edit_process_artifacts", "request_user_decision"}, []string{"repository_observation", "requirements_baseline"}, []string{"requirements.capture", "requirements.clarify", "requirements.validate"}, []string{"requirements_ready"}, domain.ActionCompleteRequirements, "requirements-result@1"},
	{domain.NodeDesign, "Select and explain the simplest viable design for the current requirements baseline.", []string{"requirements_current", "repository_context_available"}, []string{"design_approach_defined", "design_components_bounded", "design_decisions_explicit", "design_alternatives_considered", "design_complexity_justified", "design_risks_recorded"}, []string{"read_repository", "edit_process_artifacts", "request_user_decision"}, []string{"repository_observation", "design_baseline"}, []string{"design.choose_approach", "design.review_complexity", "design.record_decisions"}, []string{"design_ready", "design_requires_requirements"}, domain.ActionCompleteDesign, "design-result@1"},
	{domain.NodeTasks, "Decompose the current design into bounded, ordered, independently checkable work items.", []string{"requirements_current", "design_current"}, []string{"task_items_nonempty", "task_dependencies_valid", "task_acceptance_covered", "task_paths_bounded", "task_verification_defined"}, []string{"read_repository", "edit_process_artifacts"}, []string{"repository_observation", "task_plan_baseline"}, []string{"tasks.decompose", "tasks.map_acceptance", "tasks.analyze_consistency"}, []string{"tasks_ready", "tasks_require_design", "tasks_require_requirements"}, domain.ActionCompleteTasks, "tasks-result@1"},
	{domain.NodeImplement, "Execute the current task plan and report the exact changed surface and deviations.", []string{"requirements_current", "design_current", "task_plan_current"}, []string{"implementation_scope_reported", "implementation_paths_reported", "implementation_deviations_classified", "implementation_repository_observed"}, []string{"read_repository", "edit_product_files", "edit_process_artifacts"}, []string{"repository_observation", "implementation_summary"}, []string{"implementation.execute_plan", "implementation.record_surface", "implementation.classify_deviations"}, []string{"implementation_ready_for_test", "implementation_requires_design", "implementation_requires_requirements", "implementation_needs_refactor"}, domain.ActionCompleteImplementation, "implementation-result@1"},
	{domain.NodeTest, "Verify the current repository behavior within the immutable verification budget.", []string{"implementation_current", "repository_binding_current", "verification_budget_available"}, []string{"test_checks_classified", "test_failures_classified", "test_unverified_items_recorded", "test_budget_obeyed"}, []string{"read_repository", "run_verification_commands", "edit_process_artifacts"}, []string{"repository_observation", "test_summary"}, []string{"test.run_budgeted_checks", "test.record_evidence", "test.classify_failure"}, []string{"tests_passed", "tests_failed_implementation", "tests_expose_design_issue", "tests_expose_requirement_issue"}, domain.ActionCompleteTest, "test-result@1"},
	{domain.NodeComprehensionReview, "Verify that the developer can explain and maintain the current design and implementation.", []string{"test_current_and_passed", "repository_binding_current", "requirements_design_plan_current"}, []string{"comprehension_explanation_complete", "comprehension_complexity_classified", "comprehension_questions_resolved_or_routed", "comprehension_user_verdict_recorded"}, []string{"read_repository", "edit_process_artifacts", "request_user_decision"}, []string{"repository_observation", "comprehension_assessment"}, []string{"comprehension.explain", "comprehension.identify_complexity", "comprehension.obtain_user_verdict"}, []string{"comprehension_passed", "implementation_defect", "code_too_complex", "design_too_complex", "evidence_insufficient", "requirement_unclear"}, domain.ActionCompleteComprehensionReview, "comprehension-result@1"},
	{domain.NodeRefactor, "Simplify the current design and code without silently changing approved behavior.", []string{"simplification_reason_available", "current_authorities_available"}, []string{"refactor_simplifications_reported", "refactor_changed_surface_reported", "refactor_behavior_intent_explicit", "refactor_repository_observed"}, []string{"read_repository", "edit_product_files", "edit_process_artifacts"}, []string{"repository_observation", "refactor_summary"}, []string{"refactor.simplify", "refactor.reconcile_artifacts", "refactor.record_surface"}, []string{"refactor_ready_for_test", "refactor_requires_design", "refactor_requires_requirements"}, domain.ActionCompleteRefactor, "refactor-result@1"},
	{domain.NodeDelivery, "Reconcile the latest requirements, repository, test, comprehension, evidence, risks, and handoff.", []string{"requirements_current", "design_current", "task_plan_current", "test_current_and_passed", "comprehension_current_and_passed", "repository_binding_current"}, []string{"delivery_acceptance_complete", "delivery_evidence_current", "delivery_unverified_empty", "delivery_risks_recorded", "delivery_method_artifacts_reconciled"}, []string{"read_repository", "edit_process_artifacts", "prepare_delivery_summary"}, []string{"repository_observation", "delivery_summary"}, []string{"delivery.reconcile_acceptance", "delivery.reconcile_method_artifacts", "delivery.prepare_summary"}, []string{"delivery_complete", "delivery_needs_implementation", "delivery_needs_test", "delivery_needs_comprehension", "delivery_needs_design", "delivery_needs_requirements"}, domain.ActionCompleteDelivery, "delivery-result@1"},
}

func StandardProcess() domain.ProcessDefinition {
	byID := map[string]domain.TransitionDefinition{}
	for _, v := range standardTransitions {
		byID[string(v.TransitionID)] = v
	}
	nodes := make([]domain.NodeDefinition, 0, 11)
	for _, s := range specs {
		effects := make([]domain.AllowedEffect, len(s.effects))
		for i, v := range s.effects {
			effects[i] = domain.AllowedEffect(v)
		}
		evidence := make([]domain.EvidenceRequirement, len(s.evidence))
		for i, v := range s.evidence {
			evidence[i] = domain.EvidenceRequirement{Kind: domain.EvidenceRequirementKind(v), Required: true}
		}
		steps := make([]domain.SemanticMethodStep, len(s.steps))
		for i, v := range s.steps {
			steps[i] = domain.SemanticMethodStep{StepID: domain.MethodStepID(v), Purpose: "Perform the " + humanize(v) + " step for this node.", Required: true}
		}
		out := make([]domain.TransitionDefinition, len(s.outgoing))
		for i, v := range s.outgoing {
			out[i] = byID[v]
		}
		nodes = append(nodes, domain.NodeDefinition{NodeID: s.id, Purpose: s.purpose, EntryConditionIDs: append([]string(nil), s.entry...), EntryAssumptions: append([]string(nil), s.entry...), CompletionConditionIDs: append([]string(nil), s.complete...), CompletionConditions: append([]string(nil), s.complete...), AllowedEffects: effects, RequiredEvidence: evidence, SemanticMethodSteps: steps, OutgoingTransitions: out, ActionKind: s.action, PayloadContract: s.payload})
	}
	nodes = append(nodes, domain.NodeDefinition{NodeID: domain.NodeDone}, domain.NodeDefinition{NodeID: domain.NodeBlocked, Purpose: "Preserve a safety or recovery blocker.", EntryConditionIDs: []string{"blocker_recorded"}, EntryAssumptions: []string{"blocker_recorded"}, CompletionConditionIDs: []string{"blocker_condition_resolved"}, CompletionConditions: []string{"blocker_condition_resolved"}, AllowedEffects: []domain.AllowedEffect{domain.EffectReadRepository, domain.EffectResolveBlocker}, RequiredEvidence: []domain.EvidenceRequirement{{Kind: "repository_observation", Required: true}, {Kind: "blocker_resolution", Required: true}}, SemanticMethodSteps: []domain.SemanticMethodStep{{StepID: "blocker.resolve", Purpose: "blocker.resolve", Required: true}}, ActionKind: domain.ActionResolveBlocker, PayloadContract: "blocker-resolution@1"}, domain.NodeDefinition{NodeID: domain.NodeCancelled})
	d := domain.ProcessDefinition{Reference: domain.ProcessReference{ID: domain.ProcessStandardDevelopment, Version: 1}, EntryNode: domain.NodeRequirements, Nodes: nodes, Transitions: append([]domain.TransitionDefinition(nil), standardTransitions...)}
	digest, err := DefinitionDigest(d)
	if err != nil {
		panic("standard process definition digest failed: " + err.Error())
	}
	d.Reference.DefinitionDigest = digest
	return d
}
