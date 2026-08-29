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
	Findings                []string          `json:"findings"`
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
	schema, ok := payloadSchema(node)
	if !ok {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	if violations := requiredMemberViolations("payload", raw, schema); len(violations) != 0 {
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
	if violations := unknownMemberViolations("payload.node_result", envelope.NodeResult, reflect.TypeOf(result)); len(violations) != 0 {
		return StandardPayload{}, nil, domain.InvalidArgumentViolations(violations...)
	}
	if err := decodeClosed(envelope.NodeResult, result); err != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	return envelope, result, nil
}

// payloadSchema returns the canonical payload schema of one node's results. The
// canonical schema stays the authority for the internal payload, retained
// records and the apply boundary.
func payloadSchema(node domain.NodeID) (map[string]any, bool) {
	var kind domain.ActionKind
	switch node {
	case domain.NodeRequirements:
		kind = domain.ActionCompleteRequirements
	case domain.NodeDesign:
		kind = domain.ActionCompleteDesign
	case domain.NodeTasks:
		kind = domain.ActionCompleteTasks
	case domain.NodeImplement:
		kind = domain.ActionCompleteImplementation
	case domain.NodeTest:
		kind = domain.ActionCompleteTest
	case domain.NodeComprehensionReview:
		kind = domain.ActionCompleteComprehensionReview
	case domain.NodeRefactor:
		kind = domain.ActionCompleteRefactor
	case domain.NodeDelivery:
		kind = domain.ActionCompleteDelivery
	default:
		return nil, false
	}
	for _, entry := range ActionPayloadSchemas() {
		if entry.Kind == kind {
			return entry.Schema, true
		}
	}
	return nil, false
}

// requiredMemberViolations walks one closed schema and reports every required
// member missing from raw at a stable field path: members extend the path with
// `.name` and array entries with `[index]`. It covers the structures the closed
// contract declares — objects with required sets, nullable object unions, oneOf
// branches and arrays of objects — and leaves every type, format and value
// failure to the closed decoder, so one input never produces two failure
// classes for the same member.
func requiredMemberViolations(path string, raw []byte, schema map[string]any) []domain.ContractViolation {
	if schema == nil || isJSONNull(raw) {
		return nil
	}
	if alternatives := schemaAlternatives(schema, "anyOf"); alternatives != nil {
		return unionMemberViolations(path, raw, alternatives)
	}
	if alternatives := schemaAlternatives(schema, "oneOf"); alternatives != nil {
		return unionMemberViolations(path, raw, alternatives)
	}
	properties, _ := schema["properties"].(map[string]any)
	if len(properties) == 0 {
		if items, ok := schema["items"].(map[string]any); ok {
			return arrayMemberViolations(path, raw, items)
		}
		return nil
	}
	members, ok := jsonObjectMembers(raw)
	if !ok {
		return nil
	}
	var out []domain.ContractViolation
	for _, name := range schemaRequiredNames(schema) {
		if _, present := members[name]; present {
			continue
		}
		if violation := domain.Violation(path+"."+name, domain.RuleRequiredMemberMissing); violation.Path != "" {
			out = append(out, violation)
		}
	}
	names := make([]string, 0, len(members))
	for name := range members {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		member, known := properties[name].(map[string]any)
		if !known {
			continue
		}
		out = append(out, requiredMemberViolations(path+"."+name, members[name], member)...)
	}
	return out
}

// unionMemberViolations checks one closed union against the first alternative
// whose declared type matches the value. A value matching no declared type has
// no member presence to report; the closed decoder refuses it.
func unionMemberViolations(path string, raw []byte, alternatives []any) []domain.ContractViolation {
	valueType := rawJSONType(raw)
	for _, alternative := range alternatives {
		schema, ok := alternative.(map[string]any)
		if !ok || !unionAlternativeMatches(schema, valueType) {
			continue
		}
		return requiredMemberViolations(path, raw, schema)
	}
	return nil
}

func unionAlternativeMatches(schema map[string]any, valueType string) bool {
	declared, ok := schema["type"].(string)
	if !ok {
		if _, hasProperties := schema["properties"]; hasProperties {
			declared = "object"
		} else if _, hasItems := schema["items"]; hasItems {
			declared = "array"
		} else {
			return true
		}
	}
	return declared == valueType
}

func schemaAlternatives(schema map[string]any, keyword string) []any {
	alternatives, _ := schema[keyword].([]any)
	return alternatives
}

func schemaRequiredNames(schema map[string]any) []string {
	switch names := schema["required"].(type) {
	case []string:
		return names
	case []any:
		out := make([]string, 0, len(names))
		for _, name := range names {
			if text, ok := name.(string); ok {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func arrayMemberViolations(path string, raw []byte, items map[string]any) []domain.ContractViolation {
	var entries []json.RawMessage
	if json.Unmarshal(raw, &entries) != nil {
		return nil
	}
	var out []domain.ContractViolation
	for index, entry := range entries {
		out = append(out, requiredMemberViolations(fmt.Sprintf("%s[%d]", path, index), entry, items)...)
	}
	return out
}

func jsonObjectMembers(raw []byte) (map[string]json.RawMessage, bool) {
	var members map[string]json.RawMessage
	if json.Unmarshal(raw, &members) != nil || members == nil {
		return nil, false
	}
	return members, true
}

// rawJSONType classifies a raw JSON value for union selection only. The closed
// decoder stays the authority for type enforcement.
func rawJSONType(raw []byte) string {
	trimmed := bytes.TrimSpace(raw)
	switch {
	case bytes.HasPrefix(trimmed, []byte("{")):
		return "object"
	case bytes.HasPrefix(trimmed, []byte("[")):
		return "array"
	case bytes.HasPrefix(trimmed, []byte(`"`)):
		return "string"
	case bytes.Equal(trimmed, []byte("true")), bytes.Equal(trimmed, []byte("false")):
		return "boolean"
	default:
		return "integer"
	}
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

func isJSONNull(raw []byte) bool { return bytes.Equal(bytes.TrimSpace(raw), []byte("null")) }
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
		if source != domain.NodeRequirements || value.Baseline == nil {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{
			"baseline.scope": value.Baseline.Scope, "baseline.out_of_scope": value.Baseline.OutOfScope,
			"baseline.acceptance_criteria": value.Baseline.AcceptanceCriteria, "baseline.constraints": value.Baseline.Constraints,
			"baseline.assumptions": value.Baseline.Assumptions, "unresolved_questions": value.UnresolvedQuestions,
		})...)
		if !validText(value.Baseline.Goal, domain.MaxEvidenceSummaryBytes) {
			violations = append(violations, domain.Violation("payload.node_result.baseline.goal", domain.RuleTextNotNormalized))
		}
		if len(value.Baseline.AcceptanceCriteria) == 0 {
			violations = append(violations, domain.Violation("payload.node_result.baseline.acceptance_criteria", domain.RuleRequiredCollectionNonEmpty))
		}
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
	case *DesignResult:
		if source != domain.NodeDesign || ((envelope.TransitionID == "design_ready") != (value.Baseline != nil)) {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"findings": value.Findings})...)
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
	case *TasksResult:
		if source != domain.NodeTasks || ((envelope.TransitionID == "tasks_ready") != (value.Baseline != nil)) {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"findings": value.Findings})...)
		if value.Baseline != nil && !validWorkItemPaths(value.Baseline.WorkItems) {
			violations = append(violations, domain.Violation("payload.node_result.baseline.work_items", domain.RuleRepositoryPathInvalid))
		}
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
	case *ImplementationResult:
		if source != domain.NodeImplement {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"deviations": value.Deviations, "findings": value.Findings})...)
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
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
		if source != domain.NodeComprehensionReview {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{
			"explained_components": value.ExplainedComponents, "unresolved_questions": value.UnresolvedQuestions,
			"unnecessary_abstractions": value.UnnecessaryAbstractions, "maintenance_risks": value.MaintenanceRisks, "findings": value.Findings,
		})...)
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
		if value.UserConfirmation != nil {
			if !value.UserConfirmation.Source.IsValid() || !value.UserConfirmation.Status.IsValid() || !validText(value.UserConfirmation.Summary, domain.MaxEvidenceSummaryBytes) {
				return domain.ErrInvalidArgument
			}
		}
	case *RefactorResult:
		if source != domain.NodeRefactor {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"simplifications": value.Simplifications, "findings": value.Findings})...)
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
		}
	case *DeliveryResult:
		if source != domain.NodeDelivery {
			return domain.ErrInvalidArgument
		}
		violations := repositoryMutationViolations(value.ChangedPaths, value.NoFileChanges)
		violations = append(violations, stringListViolations(map[string][]string{"unverified_items": value.UnverifiedItems, "risks": value.Risks, "findings": value.Findings})...)
		if len(violations) != 0 {
			return domain.InvalidArgumentViolations(violations...)
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
