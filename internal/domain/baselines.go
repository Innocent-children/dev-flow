package domain

import (
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"
)

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
	if !r.Role.IsValid() || validateRepositoryRelativePath(r.Path) != nil || !r.Digest.IsValid() || requireNormalizedText(r.Summary, MaxEvidenceSummaryBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
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
	if b.Revision == 0 || b.RequirementsRevision == 0 || !b.Digest.IsValid() || requireNormalizedText(b.Approach, MaxGuidanceBytes, true) != nil || len(b.Decisions) == 0 || validateUTC(b.CreatedAt) != nil || validateArtifacts(b.ArtifactRefs) != nil {
		return ErrInvalidArgument
	}
	for _, list := range [][]string{b.Components, b.Decisions, b.RejectedAlternatives, b.ComplexityJustification, b.Risks} {
		if validateNormalizedList(list) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

type WorkItem struct {
	WorkItemID        ID       `json:"work_item_id"`
	Summary           string   `json:"summary"`
	ExpectedPaths     []string `json:"expected_paths"`
	AcceptanceIndexes []uint32 `json:"acceptance_indexes"`
	VerificationSteps []string `json:"verification_steps"`
	Dependencies      []ID     `json:"dependencies"`
}
type TaskPlanBaseline struct {
	Revision       uint32              `json:"revision"`
	Digest         Digest              `json:"digest"`
	DesignRevision uint32              `json:"design_revision"`
	WorkItems      []WorkItem          `json:"work_items"`
	ArtifactRefs   []ArtifactReference `json:"artifact_refs"`
	CreatedAt      time.Time           `json:"created_at"`
}

func (b TaskPlanBaseline) Validate() error {
	if b.Revision == 0 || b.DesignRevision == 0 || !b.Digest.IsValid() || len(b.WorkItems) == 0 || len(b.WorkItems) > MaxWorkItemsPerTaskPlan || validateUTC(b.CreatedAt) != nil || validateArtifacts(b.ArtifactRefs) != nil {
		return ErrInvalidArgument
	}
	known := map[ID]bool{}
	for _, item := range b.WorkItems {
		if validateID(item.WorkItemID) != nil || known[item.WorkItemID] || requireNormalizedText(item.Summary, MaxEvidenceSummaryBytes, true) != nil || len(item.Dependencies) > MaxDependenciesPerWorkItem {
			return ErrInvalidArgument
		}
		known[item.WorkItemID] = true
		paths := map[string]bool{}
		for _, p := range item.ExpectedPaths {
			if validateRepositoryRelativePath(p) != nil || paths[p] {
				return ErrInvalidArgument
			}
			paths[p] = true
		}
		if len(item.VerificationSteps) == 0 || validateNormalizedList(item.VerificationSteps) != nil {
			return ErrInvalidArgument
		}
		acceptance := map[uint32]bool{}
		for _, index := range item.AcceptanceIndexes {
			if acceptance[index] {
				return ErrInvalidArgument
			}
			acceptance[index] = true
		}
		dependencies := map[ID]bool{}
		for _, dependency := range item.Dependencies {
			if dependencies[dependency] {
				return ErrInvalidArgument
			}
			dependencies[dependency] = true
		}
	}
	for _, item := range b.WorkItems {
		for _, dep := range item.Dependencies {
			if !known[dep] || dep == item.WorkItemID {
				return ErrInvalidArgument
			}
		}
	}
	if hasDependencyCycle(b.WorkItems) {
		return ErrInvalidArgument
	}
	return nil
}

func validateRepositoryRelativePath(value string) error {
	if !utf8.ValidString(value) || value == "" || filepath.IsAbs(value) || filepath.Clean(value) != value || value == ".." || strings.HasPrefix(value, ".."+string(filepath.Separator)) {
		return ErrInvalidArgument
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
	Revision                uint32    `json:"revision"`
	TaskPlanRevision        uint32    `json:"task_plan_revision"`
	RepositoryBindingDigest Digest    `json:"repository_binding_digest"`
	CompletedWorkItemIDs    []ID      `json:"completed_work_item_ids"`
	ChangedPaths            []string  `json:"changed_paths"`
	NoFileChanges           bool      `json:"no_file_changes"`
	Deviations              []string  `json:"deviations"`
	Summary                 string    `json:"summary"`
	CreatedAt               time.Time `json:"created_at"`
}

func (r ImplementationRecord) Validate() error {
	if r.Revision == 0 || r.TaskPlanRevision == 0 || !r.RepositoryBindingDigest.IsValid() || (len(r.ChangedPaths) > 0) == r.NoFileChanges || requireNormalizedText(r.Summary, MaxEvidenceSummaryBytes, true) != nil || validateUTC(r.CreatedAt) != nil || validateNormalizedList(r.Deviations) != nil {
		return ErrInvalidArgument
	}
	seen := map[ID]bool{}
	for _, id := range r.CompletedWorkItemIDs {
		if validateID(id) != nil || seen[id] {
			return ErrInvalidArgument
		}
		seen[id] = true
	}
	for _, path := range r.ChangedPaths {
		if validateRepositoryRelativePath(path) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

type TestRecord struct {
	RecordID                ID        `json:"record_id"`
	RequirementsRevision    uint32    `json:"requirements_revision"`
	DesignRevision          uint32    `json:"design_revision"`
	TaskPlanRevision        uint32    `json:"task_plan_revision"`
	RepositoryBindingDigest Digest    `json:"repository_binding_digest"`
	EvidenceIDs             []ID      `json:"evidence_ids"`
	UnverifiedItems         []string  `json:"unverified_items"`
	ManualHandoffItems      []string  `json:"manual_handoff_items"`
	PassedAt                time.Time `json:"passed_at"`
}

func (r TestRecord) Validate() error {
	if validateID(r.RecordID) != nil || r.RequirementsRevision == 0 || r.DesignRevision == 0 || r.TaskPlanRevision == 0 || !r.RepositoryBindingDigest.IsValid() || validateUTC(r.PassedAt) != nil || validateNormalizedList(r.UnverifiedItems) != nil || validateNormalizedList(r.ManualHandoffItems) != nil {
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
	RecordID                ID        `json:"record_id"`
	TestRecordID            ID        `json:"test_record_id"`
	RequirementsRevision    uint32    `json:"requirements_revision"`
	DesignRevision          uint32    `json:"design_revision"`
	TaskPlanRevision        uint32    `json:"task_plan_revision"`
	RepositoryBindingDigest Digest    `json:"repository_binding_digest"`
	ExplainedComponents     []string  `json:"explained_components"`
	MaintenanceRisks        []string  `json:"maintenance_risks"`
	UserEvidenceID          ID        `json:"user_evidence_id"`
	ConfirmedAt             time.Time `json:"confirmed_at"`
}

func (r ComprehensionAssessment) Validate() error {
	if validateID(r.RecordID) != nil || validateID(r.TestRecordID) != nil || r.RequirementsRevision == 0 || r.DesignRevision == 0 || r.TaskPlanRevision == 0 || !r.RepositoryBindingDigest.IsValid() || len(r.ExplainedComponents) == 0 || len(r.ExplainedComponents) > MaxExplainedComponents || validateID(r.UserEvidenceID) != nil || validateUTC(r.ConfirmedAt) != nil || validateNormalizedList(r.ExplainedComponents) != nil || validateNormalizedList(r.MaintenanceRisks) != nil {
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
		if item.Validate() != nil {
			return ErrInvalidArgument
		}
		key := string(item.Role) + "\x00" + item.Path + "\x00" + string(item.Digest)
		if seen[key] {
			return ErrInvalidArgument
		}
		seen[key] = true
	}
	return nil
}
func validateNormalizedList(items []string) error {
	if len(items) > MaxBoundedStringListItems {
		return ErrInvalidArgument
	}
	seen := map[string]bool{}
	for _, item := range items {
		if requireNormalizedText(item, MaxEvidenceSummaryBytes, true) != nil || seen[item] {
			return ErrInvalidArgument
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
