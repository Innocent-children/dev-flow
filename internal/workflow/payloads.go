package workflow

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"sort"
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
	ChangedPaths        []string                   `json:"changed_paths"`
	NoFileChanges       bool                       `json:"no_file_changes"`
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
	ProblemClass  ProblemClass         `json:"problem_class"`
	Baseline      *DesignBaselineInput `json:"baseline"`
	Findings      []string             `json:"findings"`
	ChangedPaths  []string             `json:"changed_paths"`
	NoFileChanges bool                 `json:"no_file_changes"`
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
	ProblemClass  ProblemClass        `json:"problem_class"`
	Baseline      *TasksBaselineInput `json:"baseline"`
	Findings      []string            `json:"findings"`
	ChangedPaths  []string            `json:"changed_paths"`
	NoFileChanges bool                `json:"no_file_changes"`
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
	ChangedPaths       []string        `json:"changed_paths"`
	NoFileChanges      bool            `json:"no_file_changes"`
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
	ChangedPaths            []string          `json:"changed_paths"`
	NoFileChanges           bool              `json:"no_file_changes"`
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
	ChangedPaths          []string                  `json:"changed_paths"`
	NoFileChanges         bool                      `json:"no_file_changes"`
}

func DecodeStandardPayload(node domain.NodeID, raw []byte) (StandardPayload, any, error) {
	if len(raw) > domain.MaxActionPayloadBytes || !utf8.Valid(raw) || rejectDuplicateMembers(raw) != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	if violations := missingMemberViolations("payload", raw, "transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if violations := missingArrayItemViolations("payload.artifacts", raw, "artifacts", "role", "path", "digest", "summary"); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if violations := missingArrayItemViolations("payload.method_evidence", raw, "method_evidence", "step_id", "status", "capability", "summary"); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if violations := unknownMemberViolations("payload", raw, reflect.TypeOf(StandardPayload{})); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
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
	if violations := nodeResultMemberViolations(node, envelope.NodeResult); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if !nodeResultHasRequiredMembers(node, envelope.NodeResult) {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	if violations := unknownMemberViolations("payload.node_result", envelope.NodeResult, reflect.TypeOf(result)); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if err := decodeClosed(envelope.NodeResult, result); err != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	return envelope, result, nil
}

// nodeResultRequiredMembers is the closed member set of one node result. It is
// the single source for both the boolean gate and the field-level projection.
func nodeResultRequiredMembers(node domain.NodeID) []string {
	switch node {
	case domain.NodeRequirements:
		return []string{"problem_class", "baseline", "unresolved_questions", "changed_paths", "no_file_changes"}
	case domain.NodeDesign, domain.NodeTasks:
		return []string{"problem_class", "baseline", "findings", "changed_paths", "no_file_changes"}
	case domain.NodeImplement:
		return []string{"problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings"}
	case domain.NodeTest:
		return []string{"problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "changed_paths", "no_file_changes"}
	case domain.NodeComprehensionReview:
		return []string{"problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings", "changed_paths", "no_file_changes"}
	case domain.NodeRefactor:
		return []string{"problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings"}
	case domain.NodeDelivery:
		return []string{"problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings", "changed_paths", "no_file_changes"}
	default:
		return nil
	}
}
func nodeResultMemberViolations(node domain.NodeID, raw []byte) []domain.ContractViolation {
	members := nodeResultRequiredMembers(node)
	if len(members) == 0 {
		return nil
	}
	violations := missingMemberViolations("payload.node_result", raw, members...)
	if node == domain.NodeTest {
		violations = append(violations, missingArrayItemViolations("payload.node_result.checks", raw, "checks", "source", "name", "status", "summary", "command_count", "full_suite")...)
	}
	return violations
}
func missingMemberViolations(path string, raw []byte, names ...string) []domain.ContractViolation {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return nil
	}
	var out []domain.ContractViolation
	for _, name := range names {
		if _, present := value[name]; !present {
			out = append(out, domain.Violation(path+"."+name, domain.RuleRequiredMemberMissing))
		}
	}
	return out
}
func missingArrayItemViolations(path string, raw []byte, field string, names ...string) []domain.ContractViolation {
	items, ok := rawObjectField(raw, field)
	if !ok {
		return nil
	}
	var entries []json.RawMessage
	if json.Unmarshal(items, &entries) != nil {
		return nil
	}
	var out []domain.ContractViolation
	for index, entry := range entries {
		out = append(out, missingMemberViolations(fmt.Sprintf("%s[%d]", path, index), entry, names...)...)
	}
	return out
}

var rawMessageType = reflect.TypeOf(json.RawMessage{})

// unknownMemberViolations walks the existing closed Go payload types so a
// nested unknown member keeps its parent object and array index. RawMessage is
// a deliberate boundary: node_result is walked separately after its current
// node type is selected.
func unknownMemberViolations(path string, raw []byte, target reflect.Type) []domain.ContractViolation {
	for target.Kind() == reflect.Pointer {
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return nil
		}
		target = target.Elem()
	}
	if target == rawMessageType {
		return nil
	}
	switch target.Kind() {
	case reflect.Struct:
		var object map[string]json.RawMessage
		if json.Unmarshal(raw, &object) != nil {
			return nil
		}
		fields := make(map[string]reflect.Type, target.NumField())
		for index := 0; index < target.NumField(); index++ {
			field := target.Field(index)
			if field.PkgPath != "" {
				continue
			}
			name := strings.Split(field.Tag.Get("json"), ",")[0]
			if name == "-" {
				continue
			}
			if name == "" {
				name = field.Name
			}
			fields[name] = field.Type
		}
		names := make([]string, 0, len(object))
		for name := range object {
			names = append(names, name)
		}
		sort.Strings(names)
		var violations []domain.ContractViolation
		for _, name := range names {
			childPath := path + "." + name
			fieldType, known := fields[name]
			if !known {
				if violation := domain.Violation(childPath, domain.RuleUnknownMember); violation.Path != "" {
					violations = append(violations, violation)
				}
				continue
			}
			violations = append(violations, unknownMemberViolations(childPath, object[name], fieldType)...)
		}
		return violations
	case reflect.Slice, reflect.Array:
		var items []json.RawMessage
		if json.Unmarshal(raw, &items) != nil {
			return nil
		}
		var violations []domain.ContractViolation
		for index, item := range items {
			violations = append(violations, unknownMemberViolations(fmt.Sprintf("%s[%d]", path, index), item, target.Elem())...)
		}
		return violations
	default:
		return nil
	}
}
func ValidateRetainedPayload(node domain.NodeID, raw []byte) error {
	envelope, result, err := DecodeStandardPayload(node, raw)
	if err != nil {
		// Keep the structured field detail so the caller learns the exact member
		// instead of a generic contract refusal.
		return err
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
		return hasJSONMembers(raw, "problem_class", "baseline", "unresolved_questions", "changed_paths", "no_file_changes") &&
			objectFieldHasMembers(raw, "baseline", false, "goal", "scope", "out_of_scope", "acceptance_criteria", "constraints", "assumptions")
	case domain.NodeDesign:
		return hasJSONMembers(raw, "problem_class", "baseline", "findings", "changed_paths", "no_file_changes") &&
			objectFieldHasMembers(raw, "baseline", true, "requirements_revision", "approach", "components", "decisions", "rejected_alternatives", "complexity_justification", "risks")
	case domain.NodeTasks:
		if !hasJSONMembers(raw, "problem_class", "baseline", "findings", "changed_paths", "no_file_changes") || !objectFieldHasMembers(raw, "baseline", true, "design_revision", "work_items") {
			return false
		}
		baseline, ok := rawObjectField(raw, "baseline")
		return !ok || isJSONNull(baseline) || arrayItemsHaveMembers(baseline, "work_items", "work_item_id", "summary", "expected_paths", "acceptance_indexes", "verification_steps", "dependencies")
	case domain.NodeImplement:
		return hasJSONMembers(raw, "problem_class", "task_plan_revision", "completed_work_item_ids", "changed_paths", "no_file_changes", "deviations", "findings")
	case domain.NodeTest:
		return hasJSONMembers(raw, "problem_class", "checks", "failed_items", "unverified_items", "manual_handoff_items", "findings", "changed_paths", "no_file_changes") &&
			arrayItemsHaveMembers(raw, "checks", "source", "name", "status", "summary", "command_count", "full_suite")
	case domain.NodeComprehensionReview:
		return hasJSONMembers(raw, "problem_class", "explained_components", "unresolved_questions", "unnecessary_abstractions", "maintenance_risks", "user_confirmation", "findings", "changed_paths", "no_file_changes") &&
			objectFieldHasMembers(raw, "user_confirmation", true, "source", "status", "summary")
	case domain.NodeRefactor:
		return hasJSONMembers(raw, "problem_class", "changed_paths", "no_file_changes", "simplifications", "behavior_change_intended", "findings")
	case domain.NodeDelivery:
		return hasJSONMembers(raw, "problem_class", "acceptance", "automated_evidence_ids", "manual_evidence_ids", "test_record_id", "comprehension_record_id", "unverified_items", "risks", "findings", "changed_paths", "no_file_changes") &&
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
	if err := validateProblemClass(source, transition, result); err != nil {
		return err
	}
	var envelopeViolations []domain.ContractViolation
	if !validText(envelope.Summary, domain.MaxEvidenceSummaryBytes) {
		envelopeViolations = append(envelopeViolations, domain.Violation("payload.summary", domain.RuleTextNotNormalized))
	}
	if !validReason(envelope.Reason, transition.ReasonRequired) {
		envelopeViolations = append(envelopeViolations, domain.Violation("payload.reason", domain.RuleTextNotNormalized))
	}
	if len(envelopeViolations) != 0 {
		return domain.InvalidArgumentViolations(envelopeViolations...)
	}
	if len(envelope.Artifacts) > domain.MaxArtifactReferencesPerAction || len(envelope.MethodEvidence) > domain.MaxMethodEvidencePerAction {
		return domain.ErrInvalidArgument
	}
	artifactPaths := map[string]bool{}
	for _, item := range envelope.Artifacts {
		if item.Validate() != nil || artifactPaths[item.Path] {
			return domain.ErrInvalidArgument
		}
		artifactPaths[item.Path] = true
	}
	if err := domain.ValidateMethodEvidence(envelope.MethodEvidence, steps); err != nil {
		return err
	}
	switch value := result.(type) {
	case *RequirementsResult:
		if source != domain.NodeRequirements || value.Baseline == nil || len(value.Baseline.AcceptanceCriteria) == 0 || len(value.UnresolvedQuestions) != 0 || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.Baseline.Scope, value.Baseline.OutOfScope, value.Baseline.AcceptanceCriteria, value.Baseline.Constraints, value.Baseline.Assumptions) {
			return domain.ErrInvalidArgument
		}
	case *DesignResult:
		if source != domain.NodeDesign || ((envelope.TransitionID == "design_ready") != (value.Baseline != nil)) || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *TasksResult:
		if source != domain.NodeTasks || ((envelope.TransitionID == "tasks_ready") != (value.Baseline != nil)) || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.Findings) || value.Baseline != nil && !validWorkItemPaths(value.Baseline.WorkItems) {
			return domain.ErrInvalidArgument
		}
	case *ImplementationResult:
		if source != domain.NodeImplement || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.Deviations, value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *TestResult:
		if source != domain.NodeTest {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"failed_items": value.FailedItems, "unverified_items": value.UnverifiedItems, "manual_handoff_items": value.ManualHandoffItems, "findings": value.Findings})...)
		seen := map[string]bool{}
		for index, check := range value.Checks {
			path := fmt.Sprintf("payload.node_result.checks[%d]", index)
			violations = append(violations, EvidenceViolations(path, check)...)
			if seen[check.Name] {
				violations = append(violations, domain.Violation(path+".name", domain.RuleEvidenceNameDuplicate))
			}
			seen[check.Name] = true
		}
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
	case *ComprehensionResult:
		if source != domain.NodeComprehensionReview || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.ExplainedComponents, value.UnresolvedQuestions, value.UnnecessaryAbstractions, value.MaintenanceRisks, value.Findings) {
			return domain.ErrInvalidArgument
		}
		if value.UserConfirmation != nil {
			if !value.UserConfirmation.Source.IsValid() || !value.UserConfirmation.Status.IsValid() || !validText(value.UserConfirmation.Summary, domain.MaxEvidenceSummaryBytes) {
				return domain.ErrInvalidArgument
			}
		}
	case *RefactorResult:
		if source != domain.NodeRefactor || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.Simplifications, value.Findings) {
			return domain.ErrInvalidArgument
		}
	case *DeliveryResult:
		if source != domain.NodeDelivery || !validRepositoryMutation(value.ChangedPaths, value.NoFileChanges) || !validStringLists(value.UnverifiedItems, value.Risks, value.Findings) {
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

func validWorkItemPaths(items []domain.WorkItem) bool {
	for _, item := range items {
		if !validRepositoryContractPaths(item.ExpectedPaths) {
			return false
		}
	}
	return true
}

func validRepositoryContractPaths(paths []string) bool {
	seen := map[string]bool{}
	for _, path := range paths {
		if domain.ValidateRepositoryContractPath(path) != nil || seen[path] {
			return false
		}
		seen[path] = true
	}
	return true
}

func validRepositoryMutation(paths []string, noFileChanges bool) bool {
	return noFileChanges == (len(paths) == 0) && validRepositoryContractPaths(paths)
}

// repositoryMutationViolations reports the changed_paths / no_file_changes
// contradiction as a field-level failure.
func repositoryMutationViolations(paths []string, noFileChanges bool) []domain.ContractViolation {
	if noFileChanges != (len(paths) == 0) {
		return []domain.ContractViolation{domain.Violation("payload.node_result.changed_paths", domain.RuleRepositoryMutationInconsistent)}
	}
	if len(paths) > domain.MaxBoundedStringListItems {
		return []domain.ContractViolation{domain.Violation("payload.node_result.changed_paths", domain.RuleStringListTooLong)}
	}
	seen := map[string]bool{}
	var violations []domain.ContractViolation
	for index, path := range paths {
		memberPath := fmt.Sprintf("payload.node_result.changed_paths[%d]", index)
		if domain.ValidateRepositoryContractPath(path) != nil {
			violations = append(violations, domain.Violation(memberPath, domain.RuleRepositoryPathInvalid))
			continue
		}
		if seen[path] {
			violations = append(violations, domain.Violation(memberPath, domain.RuleStringListDuplicate))
		}
		seen[path] = true
	}
	return violations
}

// stringListViolations names the exact bounded list that broke a list rule.
func stringListViolations(lists map[string][]string) []domain.ContractViolation {
	names := make([]string, 0, len(lists))
	for name := range lists {
		names = append(names, name)
	}
	sort.Strings(names)
	var out []domain.ContractViolation
	for _, name := range names {
		items := lists[name]
		if len(items) > domain.MaxBoundedStringListItems {
			out = append(out, domain.Violation("payload.node_result."+name, domain.RuleStringListTooLong))
			continue
		}
		seen := map[string]bool{}
		for index, item := range items {
			path := fmt.Sprintf("payload.node_result.%s[%d]", name, index)
			if !validText(item, domain.MaxEvidenceSummaryBytes) {
				out = append(out, domain.Violation(path, domain.RuleTextNotNormalized))
				continue
			}
			if seen[item] {
				out = append(out, domain.Violation(path, domain.RuleStringListDuplicate))
			}
			seen[item] = true
		}
	}
	return out
}

// KnownTransitionGuard reports whether the identifier is a transition guard of
// the current standard Process Definition. A public guard failure may only name
// a guard that exists in the live definition.
func KnownTransitionGuard(guard domain.TransitionGuardID) bool {
	if !guard.IsValid() {
		return false
	}
	for _, transition := range StandardProcess().Transitions {
		if transition.Guard == guard {
			return true
		}
	}
	return false
}

// validateProblemClass enforces the problem-class guard of the selected
// transition. A failure names the guard from the current Process Definition and
// the exact node result member, so a caller never has to guess why a forward
// transition was refused. Repository drift, member format failures and unknown
// work items are deliberately not reported as guard failures.
func validateProblemClass(source domain.NodeID, transition domain.TransitionDefinition, result any) error {
	class, findings, ok := resultProblemClass(result)
	if !ok {
		return domain.ErrInvalidArgument
	}
	if !problemClassValidForNode(source, class) {
		return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.problem_class", domain.RuleProblemClassNotValidForNode))
	}
	expected, known := problemClassByTransition[transition.TransitionID]
	if !known {
		return domain.ErrTransitionNotAllowed
	}
	if class != expected {
		return domain.TransitionGuardFailure(transition.Guard, domain.GuardViolation("payload.node_result.problem_class", domain.GuardProblemClassTransitionMismatch))
	}
	if class == ProblemNone {
		if len(findings) != 0 {
			return domain.TransitionGuardFailure(transition.Guard, domain.GuardViolation("payload.node_result.findings", domain.GuardForwardFindingsEmpty))
		}
		return nil
	}
	if len(findings) == 0 {
		return domain.TransitionGuardFailure(transition.Guard, domain.GuardViolation("payload.node_result.findings", domain.GuardProblemFindingsPresent))
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
