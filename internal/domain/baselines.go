package domain

import (
	"fmt"
	"path"
	"strings"
	"time"
	"unicode/utf8"
)

const repositoryPathSeparator = "::"

type BaselineKind string

const (
	BaselineRequirements BaselineKind = "requirements"
	BaselineDesign       BaselineKind = "design"
	BaselineTaskPlan     BaselineKind = "task_plan"
)

func (k BaselineKind) IsValid() bool {
	return k == BaselineRequirements || k == BaselineDesign || k == BaselineTaskPlan
}

type ArtifactRole string

const (
	ArtifactRequirements   ArtifactRole = "requirements"
	ArtifactDesign         ArtifactRole = "design"
	ArtifactTaskPlan       ArtifactRole = "task_plan"
	ArtifactImplementation ArtifactRole = "implementation"
	ArtifactTest           ArtifactRole = "test"
	ArtifactComprehension  ArtifactRole = "comprehension"
	ArtifactRefactor       ArtifactRole = "refactor"
	ArtifactDelivery       ArtifactRole = "delivery"
	ArtifactOtherProcess   ArtifactRole = "other_process"
)

func (r ArtifactRole) IsValid() bool {
	switch r {
	case ArtifactRequirements, ArtifactDesign, ArtifactTaskPlan, ArtifactImplementation, ArtifactTest, ArtifactComprehension, ArtifactRefactor, ArtifactDelivery, ArtifactOtherProcess:
		return true
	}
	return false
}

type ArtifactReference struct {
	Role    ArtifactRole `json:"role"`
	Path    string       `json:"path"`
	Digest  Digest       `json:"digest"`
	Summary string       `json:"summary"`
}

func (r ArtifactReference) Validate() error {
	if !r.Role.IsValid() {
		return InvalidArgumentViolations(Violation("role", RuleEnumValueInvalid))
	}
	if err := ValidateRepositoryContractPath(r.Path); err != nil {
		return AtField("path", err)
	}
	if !r.Digest.IsValid() {
		return InvalidArgumentViolations(ExplainedViolation("digest", RuleValueFormat, "digest must contain exactly 64 lowercase hexadecimal characters"))
	}
	return AtField("summary", requireNormalizedText(r.Summary, MaxEvidenceSummaryBytes, true))
}

type RequirementsBaseline struct {
	Revision           uint32              `json:"revision"`
	Digest             Digest              `json:"digest"`
	Goal               string              `json:"goal"`
	Scope              []string            `json:"scope"`
	OutOfScope         []string            `json:"out_of_scope"`
	AcceptanceCriteria []string            `json:"acceptance_criteria"`
	Constraints        []string            `json:"constraints"`
	Assumptions        []string            `json:"assumptions"`
	ArtifactRefs       []ArtifactReference `json:"artifact_refs"`
	CreatedAt          time.Time           `json:"created_at"`
}

func (b RequirementsBaseline) Validate() error {
	if b.Revision == 0 || !b.Digest.IsValid() || requireNormalizedText(b.Goal, MaxGoalBytes, true) != nil || len(b.AcceptanceCriteria) == 0 || validateUTC(b.CreatedAt) != nil || validateArtifacts(b.ArtifactRefs) != nil {
		return ErrInvalidArgument
	}
	for _, list := range [][]string{b.Scope, b.OutOfScope, b.AcceptanceCriteria, b.Constraints, b.Assumptions} {
		if validateNormalizedList(list) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

type DesignBaseline struct {
	Revision                uint32              `json:"revision"`
	Digest                  Digest              `json:"digest"`
	RequirementsRevision    uint32              `json:"requirements_revision"`
	Approach                string              `json:"approach"`
	Components              []string            `json:"components"`
	Decisions               []string            `json:"decisions"`
	RejectedAlternatives    []string            `json:"rejected_alternatives"`
	ComplexityJustification []string            `json:"complexity_justification"`
	Risks                   []string            `json:"risks"`
	ArtifactRefs            []ArtifactReference `json:"artifact_refs"`
	CreatedAt               time.Time           `json:"created_at"`
}

func (b DesignBaseline) Validate() error {
	if b.Revision == 0 || b.RequirementsRevision == 0 || !b.Digest.IsValid() || validateUTC(b.CreatedAt) != nil {
		return WithExplanation(ErrInvalidArgument, "the design record requires positive revisions, a SHA-256 digest and a UTC creation time")
	}
	if err := requireNormalizedText(b.Approach, MaxGuidanceBytes, true); err != nil {
		return AtField("approach", err)
	}
	if len(b.Decisions) == 0 {
		return InvalidArgumentViolations(Violation("decisions", RuleRequiredCollectionNonEmpty))
	}
	for _, list := range []struct {
		name   string
		values []string
	}{
		{"components", b.Components}, {"decisions", b.Decisions}, {"rejected_alternatives", b.RejectedAlternatives}, {"complexity_justification", b.ComplexityJustification}, {"risks", b.Risks},
	} {
		if err := validateNormalizedList(list.values); err != nil {
			return AtField(list.name, err)
		}
	}
	return AtField("artifact_refs", validateArtifacts(b.ArtifactRefs))
}

type WorkItem struct {
	WorkItemID        ID       `json:"work_item_id"`
	Summary           string   `json:"summary"`
	ExpectedPaths     []string `json:"expected_paths"`
	AcceptanceIndexes []uint32 `json:"acceptance_indexes"`
	VerificationSteps []string `json:"verification_steps"`
	Dependencies      []ID     `json:"dependencies"`
}

// PlanConfirmation binds the developer's verdict to the complete saved planning content.
type PlanConfirmation struct {
	Source             EvidenceSource `json:"source"`
	Status             EvidenceStatus `json:"status"`
	Summary            string         `json:"summary"`
	RequirementsDigest Digest         `json:"requirements_digest"`
	DesignDigest       Digest         `json:"design_digest"`
	TaskPlanDigest     Digest         `json:"task_plan_digest"`
	TaskPlanRevision   uint32         `json:"task_plan_revision"`
}

func (c PlanConfirmation) Validate() error {
	if c.Source != EvidenceSourceUser {
		return InvalidArgumentViolations(ExplainedViolation("source", RuleEnumValueInvalid, "confirmation source must be user"))
	}
	if c.Status != EvidencePassed {
		return InvalidArgumentViolations(ExplainedViolation("status", RuleEnumValueInvalid, "confirmation status must be passed"))
	}
	if err := requireNormalizedText(c.Summary, MaxEvidenceSummaryBytes, true); err != nil {
		return AtField("summary", err)
	}
	for _, value := range []struct {
		name   string
		digest Digest
	}{{"requirements_digest", c.RequirementsDigest}, {"design_digest", c.DesignDigest}, {"task_plan_digest", c.TaskPlanDigest}} {
		if !value.digest.IsValid() {
			return InvalidArgumentViolations(ExplainedViolation(value.name, RuleValueFormat, "digest must contain exactly 64 lowercase hexadecimal characters"))
		}
	}
	if c.TaskPlanRevision == 0 {
		return InvalidArgumentViolations(ExplainedViolation("task_plan_revision", RuleValueRange, "task_plan_revision must be positive"))
	}
	return nil
}

func (c PlanConfirmation) Matches(requirements *RequirementsBaseline, design *DesignBaseline, plan *TaskPlanBaseline) bool {
	return c.Validate() == nil && requirements != nil && design != nil && plan != nil && c.RequirementsDigest == requirements.Digest && c.DesignDigest == design.Digest && c.TaskPlanDigest == plan.Digest && c.TaskPlanRevision == plan.Revision
}

type TaskPlanBaseline struct {
	Confirmation     *PlanConfirmation   `json:"confirmation"`
	ConfirmedAt      *time.Time          `json:"confirmed_at"`
	Revision         uint32              `json:"revision"`
	Digest           Digest              `json:"digest"`
	DesignRevision   uint32              `json:"design_revision"`
	WorkItems        []WorkItem          `json:"work_items"`
	VerificationPlan VerificationPlan    `json:"verification_plan"`
	ArtifactRefs     []ArtifactReference `json:"artifact_refs"`
	CreatedAt        time.Time           `json:"created_at"`
}

func (b TaskPlanBaseline) Validate() error {
	if (b.Confirmation == nil) != (b.ConfirmedAt == nil) {
		return WithExplanation(ErrInvalidArgument, "confirmation and confirmed_at must be present together")
	}
	if b.Confirmation != nil {
		if err := b.Confirmation.Validate(); err != nil {
			return AtField("confirmation", err)
		}
		if b.Confirmation.TaskPlanDigest != b.Digest || b.Confirmation.TaskPlanRevision != b.Revision || validateUTC(*b.ConfirmedAt) != nil {
			return WithExplanation(ErrInvalidArgument, "the confirmation must refer to this plan digest and revision and have a UTC confirmation time")
		}
	}
	if b.Revision == 0 || b.DesignRevision == 0 || !b.Digest.IsValid() || validateUTC(b.CreatedAt) != nil {
		return WithExplanation(ErrInvalidArgument, "the plan record requires positive revisions, a SHA-256 digest and a UTC creation time")
	}
	if len(b.WorkItems) == 0 || len(b.WorkItems) > MaxWorkItemsPerTaskPlan {
		return InvalidArgumentViolations(ExplainedViolation("work_items", RuleValueRange, fmt.Sprintf("work_items must contain 1 to %d entries", MaxWorkItemsPerTaskPlan)))
	}
	if err := b.VerificationPlan.Validate(); err != nil {
		return AtField("verification_plan", err)
	}
	if err := validateArtifacts(b.ArtifactRefs); err != nil {
		return AtField("artifact_refs", err)
	}
	known := map[ID]bool{}
	for index, item := range b.WorkItems {
		member := fmt.Sprintf("work_items[%d]", index)
		if !item.WorkItemID.IsValid() {
			return InvalidArgumentViolations(Violation(member+".work_item_id", RuleIdentifierInvalid))
		}
		if known[item.WorkItemID] {
			return InvalidArgumentViolations(Violation(member+".work_item_id", RuleStringListDuplicate))
		}
		known[item.WorkItemID] = true
		if err := requireNormalizedText(item.Summary, MaxEvidenceSummaryBytes, true); err != nil {
			return AtField(member+".summary", err)
		}
		if len(item.Dependencies) > MaxDependenciesPerWorkItem {
			return InvalidArgumentViolations(ExplainedViolation(member+".dependencies", RuleValueRange, fmt.Sprintf("at most %d dependencies are allowed", MaxDependenciesPerWorkItem)))
		}
		paths := map[string]bool{}
		for index, p := range item.ExpectedPaths {
			path := fmt.Sprintf("%s.expected_paths[%d]", member, index)
			if err := ValidateRepositoryContractPath(p); err != nil {
				return AtField(path, err)
			}
			if paths[p] {
				return InvalidArgumentViolations(Violation(path, RuleStringListDuplicate))
			}
			paths[p] = true
		}
		if len(item.VerificationSteps) == 0 {
			return InvalidArgumentViolations(Violation(member+".verification_steps", RuleRequiredCollectionNonEmpty))
		}
		if err := validateNormalizedList(item.VerificationSteps); err != nil {
			return AtField(member+".verification_steps", err)
		}
		acceptance := map[uint32]bool{}
		for index, criterion := range item.AcceptanceIndexes {
			if acceptance[criterion] {
				return InvalidArgumentViolations(Violation(fmt.Sprintf("%s.acceptance_indexes[%d]", member, index), RuleStringListDuplicate))
			}
			acceptance[criterion] = true
		}
		dependencies := map[ID]bool{}
		for index, dependency := range item.Dependencies {
			if dependencies[dependency] {
				return InvalidArgumentViolations(Violation(fmt.Sprintf("%s.dependencies[%d]", member, index), RuleStringListDuplicate))
			}
			dependencies[dependency] = true
		}
	}
	for index, item := range b.WorkItems {
		for depIndex, dep := range item.Dependencies {
			member := fmt.Sprintf("work_items[%d].dependencies[%d]", index, depIndex)
			if !known[dep] {
				return InvalidArgumentViolations(Violation(member, RuleKnownIdentifierRequired))
			}
			if dep == item.WorkItemID {
				return InvalidArgumentViolations(ExplainedViolation(member, RuleMemberDependency, "a work item cannot depend on itself"))
			}
		}
	}
	if hasDependencyCycle(b.WorkItems) {
		return InvalidArgumentViolations(ExplainedViolation("work_items", RuleMemberDependency, "work item dependencies must not form a cycle"))
	}
	return nil
}

func validateRepositoryRelativePath(value string) error {
	if !utf8.ValidString(value) || value == "" || strings.Contains(value, repositoryPathSeparator) ||
		strings.Contains(value, `\`) || path.IsAbs(value) || path.Clean(value) != value ||
		value == ".." || strings.HasPrefix(value, "../") {
		return WithExplanation(ErrInvalidArgument, "paths must be normalized, relative to the repository, and must not contain backslashes or parent traversal")
	}
	return nil
}

func ValidateRepositoryContractPath(value string) error {
	key, relative, scoped := strings.Cut(value, repositoryPathSeparator)
	if !scoped {
		return validateRepositoryRelativePath(value)
	}
	if !RepositoryKey(key).IsValid() || validateRepositoryRelativePath(relative) != nil {
		return WithExplanation(ErrInvalidArgument, "scoped paths require a valid repository key followed by :: and a normalized repository-relative path")
	}
	return nil
}

type BaselineReference struct {
	Kind      BaselineKind `json:"kind"`
	Revision  uint32       `json:"revision"`
	Digest    Digest       `json:"digest"`
	Summary   string       `json:"summary"`
	CreatedAt time.Time    `json:"created_at"`
}

func (r BaselineReference) Validate() error {
	if !r.Kind.IsValid() || r.Revision == 0 || !r.Digest.IsValid() || requireNormalizedText(r.Summary, MaxEvidenceSummaryBytes, true) != nil || validateUTC(r.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}

type ImplementationRecord struct {
	Revision             uint32    `json:"revision"`
	TaskPlanRevision     uint32    `json:"task_plan_revision"`
	ContentDigest        Digest    `json:"content_digest"`
	CompletedWorkItemIDs []ID      `json:"completed_work_item_ids"`
	ActionChangedPaths   []string  `json:"action_changed_paths"`
	Deviations           []string  `json:"deviations"`
	Summary              string    `json:"summary"`
	CreatedAt            time.Time `json:"created_at"`
}

func (r ImplementationRecord) Validate() error {
	if r.Revision == 0 || r.TaskPlanRevision == 0 || !r.ContentDigest.IsValid() || requireNormalizedText(r.Summary, MaxEvidenceSummaryBytes, true) != nil || validateUTC(r.CreatedAt) != nil || validateNormalizedList(r.Deviations) != nil {
		return ErrInvalidArgument
	}
	seen := map[ID]bool{}
	for _, id := range r.CompletedWorkItemIDs {
		if validateID(id) != nil || seen[id] {
			return ErrInvalidArgument
		}
		seen[id] = true
	}
	paths := map[string]bool{}
	for _, path := range r.ActionChangedPaths {
		if ValidateRepositoryContractPath(path) != nil || paths[path] {
			return ErrInvalidArgument
		}
		paths[path] = true
	}
	return nil
}

type TestRecord struct {
	KnownFailureAcceptance *KnownFailureAcceptance `json:"known_failure_acceptance,omitempty"`
	RecordID               ID                      `json:"record_id"`
	RequirementsRevision   uint32                  `json:"requirements_revision"`
	DesignRevision         uint32                  `json:"design_revision"`
	TaskPlanRevision       uint32                  `json:"task_plan_revision"`
	ContentDigest          Digest                  `json:"content_digest"`
	EvidenceIDs            []ID                    `json:"evidence_ids"`
	UnverifiedItems        []string                `json:"unverified_items"`
	ManualHandoffItems     []string                `json:"manual_handoff_items"`
	CompletedAt            time.Time               `json:"completed_at"`
}

func (r TestRecord) Validate() error {
	if r.KnownFailureAcceptance != nil && (r.KnownFailureAcceptance.Validate() != nil || r.KnownFailureAcceptance.TaskPlanRevision != r.TaskPlanRevision || r.KnownFailureAcceptance.ContentDigest != r.ContentDigest) {
		return ErrInvalidArgument
	}
	if validateID(r.RecordID) != nil || r.RequirementsRevision == 0 || r.DesignRevision == 0 || r.TaskPlanRevision == 0 || !r.ContentDigest.IsValid() || validateUTC(r.CompletedAt) != nil || validateNormalizedList(r.UnverifiedItems) != nil || validateNormalizedList(r.ManualHandoffItems) != nil {
		return ErrInvalidArgument
	}
	seen := map[ID]bool{}
	for _, id := range r.EvidenceIDs {
		if validateID(id) != nil || seen[id] {
			return ErrInvalidArgument
		}
		seen[id] = true
	}
	return nil
}

type ComprehensionAssessment struct {
	RecordID             ID        `json:"record_id"`
	TestRecordID         ID        `json:"test_record_id"`
	RequirementsRevision uint32    `json:"requirements_revision"`
	DesignRevision       uint32    `json:"design_revision"`
	TaskPlanRevision     uint32    `json:"task_plan_revision"`
	ContentDigest        Digest    `json:"content_digest"`
	ExplainedComponents  []string  `json:"explained_components"`
	MaintenanceRisks     []string  `json:"maintenance_risks"`
	UserEvidenceID       ID        `json:"user_evidence_id"`
	ConfirmedAt          time.Time `json:"confirmed_at"`
}

func (r ComprehensionAssessment) Validate() error {
	if validateID(r.RecordID) != nil || validateID(r.TestRecordID) != nil || r.RequirementsRevision == 0 || r.DesignRevision == 0 || r.TaskPlanRevision == 0 || !r.ContentDigest.IsValid() || len(r.ExplainedComponents) == 0 || len(r.ExplainedComponents) > MaxExplainedComponents || validateID(r.UserEvidenceID) != nil || validateUTC(r.ConfirmedAt) != nil || validateNormalizedList(r.ExplainedComponents) != nil || validateNormalizedList(r.MaintenanceRisks) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func validateArtifacts(items []ArtifactReference) error {
	if len(items) > MaxArtifactReferencesPerAction {
		return ErrInvalidArgument
	}
	seen := map[string]bool{}
	for _, item := range items {
		if item.Validate() != nil || seen[item.Path] {
			return ErrInvalidArgument
		}
		seen[item.Path] = true
	}
	return nil
}
func validateNormalizedList(items []string) error {
	if len(items) > MaxBoundedStringListItems {
		return WithExplanation(ErrInvalidArgument, fmt.Sprintf("the list must contain at most %d items", MaxBoundedStringListItems))
	}
	seen := map[string]bool{}
	for _, item := range items {
		if err := requireNormalizedText(item, MaxEvidenceSummaryBytes, true); err != nil {
			return err
		}
		if seen[item] {
			return WithExplanation(ErrInvalidArgument, "the list must not contain duplicate text items")
		}
		seen[item] = true
	}
	return nil
}

func hasDependencyCycle(items []WorkItem) bool {
	deps := map[ID][]ID{}
	for _, i := range items {
		deps[i.WorkItemID] = i.Dependencies
	}
	visiting := map[ID]bool{}
	visited := map[ID]bool{}
	var visit func(ID) bool
	visit = func(id ID) bool {
		if visiting[id] {
			return true
		}
		if visited[id] {
			return false
		}
		visiting[id] = true
		for _, d := range deps[id] {
			if visit(d) {
				return true
			}
		}
		visiting[id] = false
		visited[id] = true
		return false
	}
	for id := range deps {
		if visit(id) {
			return true
		}
	}
	return false
}
