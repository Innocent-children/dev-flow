package workflow

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type StandardPayload struct {
	TransitionID   domain.TransitionID        `json:"transition_id"`
	Summary        string                     `json:"summary"`
	Reason         string                     `json:"reason"`
	Artifacts      []domain.ArtifactReference `json:"artifacts"`
	MethodEvidence []domain.MethodEvidence    `json:"method_evidence"`
	NodeResult     json.RawMessage            `json:"node_result"`
}
type ProblemClass string

const (
	ProblemNone                  ProblemClass = "none"
	ProblemRequirementGap        ProblemClass = "requirement_gap"
	ProblemDesignGap             ProblemClass = "design_gap"
	ProblemCodeComplexity        ProblemClass = "code_complexity"
	ProblemImplementationFailure ProblemClass = "implementation_failure"
	ProblemDesignFailure         ProblemClass = "design_failure"
	ProblemImplementationDefect  ProblemClass = "implementation_defect"
	ProblemDesignComplexity      ProblemClass = "design_complexity"
	ProblemVerificationGap       ProblemClass = "verification_gap"
	ProblemDesignChange          ProblemClass = "design_change"
	ProblemRequirementChange     ProblemClass = "requirement_change"
	ProblemImplementationGap     ProblemClass = "implementation_gap"
	ProblemTestGap               ProblemClass = "test_gap"
	ProblemComprehensionGap      ProblemClass = "comprehension_gap"
)

type RequirementsResult struct {
	ProblemClass        ProblemClass               `json:"problem_class"`
	Baseline            *RequirementsBaselineInput `json:"baseline"`
	UnresolvedQuestions []string                   `json:"unresolved_questions"`
}
type RequirementsBaselineInput struct {
	Goal               string   `json:"goal"`
	Scope              []string `json:"scope"`
	OutOfScope         []string `json:"out_of_scope"`
	AcceptanceCriteria []string `json:"acceptance_criteria"`
	Constraints        []string `json:"constraints"`
	Assumptions        []string `json:"assumptions"`
}
type DesignResult struct {
	ProblemClass ProblemClass         `json:"problem_class"`
	Baseline     *DesignBaselineInput `json:"baseline"`
	Findings     []string             `json:"findings"`
}
type DesignBaselineInput struct {
	RequirementsRevision    uint32   `json:"requirements_revision"`
	Approach                string   `json:"approach"`
	Components              []string `json:"components"`
	Decisions               []string `json:"decisions"`
	RejectedAlternatives    []string `json:"rejected_alternatives"`
	ComplexityJustification []string `json:"complexity_justification"`
	Risks                   []string `json:"risks"`
}
type TasksResult struct {
	ProblemClass ProblemClass        `json:"problem_class"`
	Baseline     *TasksBaselineInput `json:"baseline"`
	Findings     []string            `json:"findings"`
}
type TasksBaselineInput struct {
	DesignRevision uint32            `json:"design_revision"`
	WorkItems      []domain.WorkItem `json:"work_items"`
}
type ImplementationResult struct {
	ProblemClass         ProblemClass `json:"problem_class"`
	TaskPlanRevision     uint32       `json:"task_plan_revision"`
	CompletedWorkItemIDs []domain.ID  `json:"completed_work_item_ids"`
	ChangedPaths         []string     `json:"changed_paths"`
	NoFileChanges        bool         `json:"no_file_changes"`
	Deviations           []string     `json:"deviations"`
	Findings             []string     `json:"findings"`
}
type TestResult struct {
	ProblemClass       ProblemClass    `json:"problem_class"`
	Checks             []EvidenceInput `json:"checks"`
	FailedItems        []string        `json:"failed_items"`
	UnverifiedItems    []string        `json:"unverified_items"`
	ManualHandoffItems []string        `json:"manual_handoff_items"`
	Findings           []string        `json:"findings"`
}
type EvidenceInput struct {
	Source       domain.EvidenceSource `json:"source"`
	Name         string                `json:"name"`
	Status       domain.EvidenceStatus `json:"status"`
	Summary      string                `json:"summary"`
	CommandCount int                   `json:"command_count"`
	FullSuite    bool                  `json:"full_suite"`
}
type ComprehensionResult struct {
	ProblemClass            ProblemClass      `json:"problem_class"`
	ExplainedComponents     []string          `json:"explained_components"`
	UnresolvedQuestions     []string          `json:"unresolved_questions"`
	UnnecessaryAbstractions []string          `json:"unnecessary_abstractions"`
	MaintenanceRisks        []string          `json:"maintenance_risks"`
	UserConfirmation        *UserConfirmation `json:"user_confirmation"`
	Findings                []string          `json:"findings,omitempty"`
}
type UserConfirmation struct {
	Source  domain.EvidenceSource `json:"source"`
	Status  domain.EvidenceStatus `json:"status"`
	Summary string                `json:"summary"`
}
type RefactorResult struct {
	ProblemClass           ProblemClass `json:"problem_class"`
	ChangedPaths           []string     `json:"changed_paths"`
	NoFileChanges          bool         `json:"no_file_changes"`
	Simplifications        []string     `json:"simplifications"`
	BehaviorChangeIntended bool         `json:"behavior_change_intended"`
	Findings               []string     `json:"findings"`
}
type DeliveryResult struct {
	ProblemClass          ProblemClass              `json:"problem_class"`
	Acceptance            []domain.OutcomeCriterion `json:"acceptance"`
	AutomatedEvidenceIDs  []domain.ID               `json:"automated_evidence_ids"`
	ManualEvidenceIDs     []domain.ID               `json:"manual_evidence_ids"`
	TestRecordID          domain.ID                 `json:"test_record_id"`
	ComprehensionRecordID domain.ID                 `json:"comprehension_record_id"`
	UnverifiedItems       []string                  `json:"unverified_items"`
	Risks                 []string                  `json:"risks"`
	Findings              []string                  `json:"findings"`
}

func DecodeStandardPayload(node domain.NodeID, raw []byte) (StandardPayload, any, error) {
	if len(raw) > domain.MaxActionPayloadBytes || !utf8.Valid(raw) || rejectDuplicateMembers(raw) != nil ||
		!hasJSONMembers(raw, "transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result") ||
		!arrayItemsHaveMembers(raw, "artifacts", "role", "path", "digest", "summary") ||
		!arrayItemsHaveMembers(raw, "method_evidence", "step_id", "status", "capability", "summary") {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	var envelope StandardPayload
	if err := decodeClosed(raw, &envelope); err != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	var result any
	switch node {
	case domain.NodeRequirements:
		result = &RequirementsResult{}
	case domain.NodeDesign:
		result = &DesignResult{}
	case domain.NodeTasks:
		result = &TasksResult{}
	case domain.NodeImplement:
		result = &ImplementationResult{}
	case domain.NodeTest:
		result = &TestResult{}
	case domain.NodeComprehensionReview:
		result = &ComprehensionResult{}
	case domain.NodeRefactor:
		result = &RefactorResult{}
	case domain.NodeDelivery:
		result = &DeliveryResult{}
	default:
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	if !nodeResultHasRequiredMembers(node, envelope.NodeResult) {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	if err := decodeClosed(envelope.NodeResult, result); err != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	return envelope, result, nil
}
func ValidateRetainedPayload(node domain.NodeID, raw []byte) error {
	envelope, result, err := DecodeStandardPayload(node, raw)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	definition := StandardProcess()
	nodeDefinition, err := NodeDefinition(definition, node)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	return ValidatePayload(definition, node, envelope, result, nodeDefinition.SemanticMethodSteps)
}

func nodeResultHasRequiredMembers(node domain.NodeID, raw []byte) bool {
	switch node {
	case domain.NodeRequirements:
		return hasJSONMembers(raw, "problem_class", "baseline", "unresolved_questions") &&
			objectFieldHasMembers(raw, "baseline", false, "goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions")
	case domain.NodeDesign:
		return hasJSONMembers(raw, "problem_class", "baseline", "findings") &&
			objectFieldHasMembers(raw, "baseline", true, "requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks")
	case domain.NodeTasks:
		if !hasJSONMembers(raw, "problem_class", "baseline", "findings") || !objectFieldHasMembers(raw, "baseline", true, "design_revision", "work_items") {
			return false
		}
		baseline, ok := rawObjectField(raw, "baseline")
		return !ok || isJSONNull(baseline) || arrayItemsHaveMembers(baseline, "work_items", "work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies")
	case domain.NodeImplement:
		return hasJSONMembers(raw, "problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings")
	case domain.NodeTest:
		return hasJSONMembers(raw, "problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings") &&
			arrayItemsHaveMembers(raw, "checks", "source", "name", "status", "summary", "command_count", "full_suite")
	case domain.NodeComprehensionReview:
		return hasJSONMembers(raw, "problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings") &&
			objectFieldHasMembers(raw, "user_confirmation", true, "source", "status", "summary")
	case domain.NodeRefactor:
		return hasJSONMembers(raw, "problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings")
	case domain.NodeDelivery:
		return hasJSONMembers(raw, "problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings") &&
			arrayItemsHaveMembers(raw, "acceptance", "criterion", "status")
	default:
		return false
	}
}

func hasJSONMembers(raw []byte, names ...string) bool {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	for _, name := range names {
		if _, ok := value[name]; !ok {
			return false
		}
	}
	return true
}
func rawObjectField(raw []byte, name string) (json.RawMessage, bool) {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return nil, false
	}
	field, ok := value[name]
	return field, ok
}
func isJSONNull(raw []byte) bool { return bytes.Equal(bytes.TrimSpace(raw), []byte("null")) }
func objectFieldHasMembers(raw []byte, name string, nullable bool, members ...string) bool {
	field, ok := rawObjectField(raw, name)
	if !ok {
		return false
	}
	if isJSONNull(field) {
		return nullable
	}
	return hasJSONMembers(field, members...)
}
func arrayItemsHaveMembers(raw []byte, name string, members ...string) bool {
	field, ok := rawObjectField(raw, name)
	if !ok {
		return false
	}
	var items []json.RawMessage
	if json.Unmarshal(field, &items) != nil {
		return false
	}
	for _, item := range items {
		if !hasJSONMembers(item, members...) {
			return false
		}
	}
	return true
}
func ValidatePayload(definition domain.ProcessDefinition, source domain.NodeID, envelope StandardPayload, result any, steps []domain.SemanticMethodStep) error {
	transition, err := TransitionFor(definition, source, envelope.TransitionID)
	if err != nil {
		return err
	}
	if err := validateProblemClass(source, envelope.TransitionID, result); err != nil {
		return err
	}
	if !validText(envelope.Summary, domain.MaxEvidenceSummaryBytes) || !validReason(envelope.Reason, transition.ReasonRequired) || len(envelope.Artifacts) > domain.MaxArtifactReferencesPerAction || len(envelope.MethodEvidence) > domain.MaxMethodEvidencePerAction {
		return domain.ErrInvalidArgument
	}
	for _, item := range envelope.Artifacts {
		if item.Validate() != nil {
			return domain.ErrInvalidArgument
		}
	}
	for _, item := range envelope.MethodEvidence {
		if item.Validate(steps) != nil {
			return domain.ErrInvalidArgument
		}
	}
	switch value := result.(type) {
	case *RequirementsResult:
		if source != domain.NodeRequirements || value.Baseline == nil || len(value.Baseline.AcceptanceCriteria) == 0 || len(value.UnresolvedQuestions) != 0 || !validStringLists(value.Baseline.Scope, value.Baseline.OutOfScope, value.Baseline.AcceptanceCriteria, value.Baseline.Constraints, value.Baseline.Assumptions) {
			return domain.ErrInvalidArgument
		}
	case *DesignResult:
		if source != domain.NodeDesign || ((envelope.TransitionID == "design_ready") != (value.Baseline != nil)) || !validStringLists(value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *TasksResult:
		if source != domain.NodeTasks || ((envelope.TransitionID == "tasks_ready") != (value.Baseline != nil)) || !validStringLists(value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *ImplementationResult:
		if source != domain.NodeImplement || (len(value.ChangedPaths) > 0) == value.NoFileChanges || !validStringLists(value.Deviations, value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *TestResult:
		if source != domain.NodeTest || !validStringLists(value.FailedItems, value.UnverifiedItems, value.ManualHandoffItems, value.Findings) {
			return domain.ErrInvalidArgument
		}
		seen := map[string]bool{}
		for _, check := range value.Checks {
			if validateNormalizedEvidenceInput(check) != nil || seen[check.Name] {
				return domain.ErrInvalidArgument
			}
			seen[check.Name] = true
		}
	case *ComprehensionResult:
		if source != domain.NodeComprehensionReview || !validStringLists(value.ExplainedComponents, value.UnresolvedQuestions, value.UnnecessaryAbstractions, value.MaintenanceRisks, value.Findings) {
			return domain.ErrInvalidArgument
		}
		if value.UserConfirmation != nil {
			if !value.UserConfirmation.Source.IsValid() || !value.UserConfirmation.Status.IsValid() || !validText(value.UserConfirmation.Summary, domain.MaxEvidenceSummaryBytes) {
				return domain.ErrInvalidArgument
			}
		}
	case *RefactorResult:
		if source != domain.NodeRefactor || (len(value.ChangedPaths) > 0) == value.NoFileChanges || !validStringLists(value.Simplifications, value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *DeliveryResult:
		if source != domain.NodeDelivery || !validStringLists(value.UnverifiedItems, value.Risks, value.Findings) {
			return domain.ErrInvalidArgument
		}
		for _, criterion := range value.Acceptance {
			if criterion.Validate() != nil {
				return domain.ErrInvalidArgument
			}
		}
		for _, ids := range [][]domain.ID{value.AutomatedEvidenceIDs, value.ManualEvidenceIDs} {
			for _, id := range ids {
				if !id.IsValid() {
					return domain.ErrInvalidArgument
				}
			}
		}
		if value.TestRecordID != "" && !value.TestRecordID.IsValid() {
			return domain.ErrInvalidArgument
		}
		if value.ComprehensionRecordID != "" && !value.ComprehensionRecordID.IsValid() {
			return domain.ErrInvalidArgument
		}
	default:
		return domain.ErrInvalidArgument
	}
	return nil
}
func validateProblemClass(source domain.NodeID, transition domain.TransitionID, result any) error {
	class, findings, ok := resultProblemClass(result)
	if !ok || !problemClassValidForNode(source, class) {
		return domain.ErrInvalidArgument
	}
	expected, ok := problemClassByTransition[transition]
	if !ok || class != expected {
		return domain.ErrTransitionNotAllowed
	}
	if class == ProblemNone {
		if len(findings) != 0 {
			return domain.ErrTransitionNotAllowed
		}
		return nil
	}
	if len(findings) == 0 {
		return domain.ErrTransitionNotAllowed
	}
	return nil
}
func resultProblemClass(result any) (ProblemClass, []string, bool) {
	switch value := result.(type) {
	case *RequirementsResult:
		return value.ProblemClass, nil, true
	case *DesignResult:
		return value.ProblemClass, value.Findings, true
	case *TasksResult:
		return value.ProblemClass, value.Findings, true
	case *ImplementationResult:
		return value.ProblemClass, value.Findings, true
	case *TestResult:
		return value.ProblemClass, value.Findings, true
	case *ComprehensionResult:
		return value.ProblemClass, value.Findings, true
	case *RefactorResult:
		return value.ProblemClass, value.Findings, true
	case *DeliveryResult:
		return value.ProblemClass, value.Findings, true
	default:
		return "", nil, false
	}
}
func problemClassValidForNode(node domain.NodeID, class ProblemClass) bool {
	switch node {
	case domain.NodeRequirements:
		return class == ProblemNone
	case domain.NodeDesign:
		return class == ProblemNone || class == ProblemRequirementGap
	case domain.NodeTasks:
		return class == ProblemNone || class == ProblemDesignGap || class == ProblemRequirementGap
	case domain.NodeImplement:
		return class == ProblemNone || class == ProblemDesignGap || class == ProblemRequirementGap || class == ProblemCodeComplexity
	case domain.NodeTest:
		return class == ProblemNone || class == ProblemImplementationFailure || class == ProblemDesignFailure || class == ProblemRequirementGap
	case domain.NodeComprehensionReview:
		return class == ProblemNone || class == ProblemImplementationDefect || class == ProblemCodeComplexity || class == ProblemDesignComplexity || class == ProblemVerificationGap || class == ProblemRequirementGap
	case domain.NodeRefactor:
		return class == ProblemNone || class == ProblemDesignChange || class == ProblemRequirementChange
	case domain.NodeDelivery:
		return class == ProblemNone || class == ProblemImplementationGap || class == ProblemTestGap || class == ProblemComprehensionGap || class == ProblemDesignGap || class == ProblemRequirementGap
	default:
		return false
	}
}

var problemClassByTransition = map[domain.TransitionID]ProblemClass{
	"requirements_ready":                   ProblemNone,
	"design_ready":                         ProblemNone,
	"design_requires_requirements":         ProblemRequirementGap,
	"tasks_ready":                          ProblemNone,
	"tasks_require_design":                 ProblemDesignGap,
	"tasks_require_requirements":           ProblemRequirementGap,
	"implementation_ready_for_test":        ProblemNone,
	"implementation_requires_design":       ProblemDesignGap,
	"implementation_requires_requirements": ProblemRequirementGap,
	"implementation_needs_refactor":        ProblemCodeComplexity,
	"tests_passed":                         ProblemNone,
	"tests_failed_implementation":          ProblemImplementationFailure,
	"tests_expose_design_issue":            ProblemDesignFailure,
	"tests_expose_requirement_issue":       ProblemRequirementGap,
	"comprehension_passed":                 ProblemNone,
	"implementation_defect":                ProblemImplementationDefect,
	"code_too_complex":                     ProblemCodeComplexity,
	"design_too_complex":                   ProblemDesignComplexity,
	"evidence_insufficient":                ProblemVerificationGap,
	"requirement_unclear":                  ProblemRequirementGap,
	"refactor_ready_for_test":              ProblemNone,
	"refactor_requires_design":             ProblemDesignChange,
	"refactor_requires_requirements":       ProblemRequirementChange,
	"delivery_complete":                    ProblemNone,
	"delivery_needs_implementation":        ProblemImplementationGap,
	"delivery_needs_test":                  ProblemTestGap,
	"delivery_needs_comprehension":         ProblemComprehensionGap,
	"delivery_needs_design":                ProblemDesignGap,
	"delivery_needs_requirements":          ProblemRequirementGap,
}

func CanonicalPayload(envelope StandardPayload) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(envelope); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}
func CanonicalValidatedPayload(envelope StandardPayload, result any) ([]byte, error) {
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	envelope.NodeResult = raw
	return CanonicalPayload(envelope)
}
func decodeClosed(raw []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}
func validText(value string, max int) bool {
	return utf8.ValidString(value) && value == strings.TrimSpace(value) && value != "" && len(value) <= max
}
func validReason(value string, required bool) bool {
	if !required {
		return value == ""
	}
	return validText(value, domain.MaxReasonBytes)
}

func validStringLists(lists ...[]string) bool {
	for _, items := range lists {
		if len(items) > domain.MaxBoundedStringListItems {
			return false
		}
		seen := map[string]bool{}
		for _, item := range items {
			if !validText(item, domain.MaxEvidenceSummaryBytes) || seen[item] {
				return false
			}
			seen[item] = true
		}
	}
	return true
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
		switch delimiter {
		case '{':
			seen := map[string]bool{}
			for decoder.More() {
				keyToken, err := decoder.Token()
				if err != nil {
					return err
				}
				key := keyToken.(string)
				if seen[key] {
					return fmt.Errorf("duplicate member %s", key)
				}
				seen[key] = true
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = decoder.Token()
			return err
		case '[':
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
