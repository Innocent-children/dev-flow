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
type RequirementsResult struct {
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
	Baseline *DesignBaselineInput `json:"baseline"`
	Findings []string             `json:"findings"`
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
	Baseline *TasksBaselineInput `json:"baseline"`
	Findings []string            `json:"findings"`
}
type TasksBaselineInput struct {
	DesignRevision uint32            `json:"design_revision"`
	WorkItems      []domain.WorkItem `json:"work_items"`
}
type ImplementationResult struct {
	TaskPlanRevision     uint32      `json:"task_plan_revision"`
	CompletedWorkItemIDs []domain.ID `json:"completed_work_item_ids"`
	ChangedPaths         []string    `json:"changed_paths"`
	NoFileChanges        bool        `json:"no_file_changes"`
	Deviations           []string    `json:"deviations"`
	Findings             []string    `json:"findings"`
}
type TestResult struct {
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
	ChangedPaths           []string `json:"changed_paths"`
	NoFileChanges          bool     `json:"no_file_changes"`
	Simplifications        []string `json:"simplifications"`
	BehaviorChangeIntended bool     `json:"behavior_change_intended"`
	Findings               []string `json:"findings"`
}
type DeliveryResult struct {
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
	if len(raw) > domain.MaxActionPayloadBytes || rejectDuplicateMembers(raw) != nil {
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
	if err := decodeClosed(envelope.NodeResult, result); err != nil {
		return StandardPayload{}, nil, domain.ErrInvalidArgument
	}
	return envelope, result, nil
}
func ValidatePayload(definition domain.ProcessDefinition, source domain.NodeID, envelope StandardPayload, result any, steps []domain.SemanticMethodStep) error {
	transition, err := TransitionFor(definition, source, envelope.TransitionID)
	if err != nil {
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
		if source != domain.NodeTest {
			return domain.ErrInvalidArgument
		}
	case *ComprehensionResult:
		if source != domain.NodeComprehensionReview {
			return domain.ErrInvalidArgument
		}
		if envelope.TransitionID == "comprehension_passed" && (value.UserConfirmation == nil || value.UserConfirmation.Source != domain.EvidenceSourceUser || value.UserConfirmation.Status != domain.EvidencePassed || len(value.ExplainedComponents) == 0 || len(value.UnresolvedQuestions) != 0 || len(value.UnnecessaryAbstractions) != 0) {
			return domain.ErrInvalidArgument
		}
	case *RefactorResult:
		if source != domain.NodeRefactor {
			return domain.ErrInvalidArgument
		}
		if envelope.TransitionID == "refactor_ready_for_test" && (len(value.Simplifications) == 0 || value.BehaviorChangeIntended) {
			return domain.ErrInvalidArgument
		}
	case *DeliveryResult:
		if source != domain.NodeDelivery {
			return domain.ErrInvalidArgument
		}
	default:
		return domain.ErrInvalidArgument
	}
	return nil
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
