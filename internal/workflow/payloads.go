package workflow

import (
	"bytes"
	"encoding/json"
	"path"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// ActionPayload is the closed set of stage payloads accepted by the workflow.
// The unexported marker prevents adapters from adding another payload kind.
type ActionPayload interface {
	actionPayload()
}

type AssessTaskPayload struct {
	Result                         domain.ActionResult `json:"result"`
	Summary                        string              `json:"summary"`
	Constraints                    []string            `json:"constraints"`
	Risks                          []string            `json:"risks"`
	IntendedChangedSurface         []string            `json:"intended_changed_surface"`
	VerificationBudgetAcknowledged bool                `json:"verification_budget_acknowledged"`
}

func (AssessTaskPayload) actionPayload() {}

type PlanChangePayload struct {
	Result               domain.ActionResult `json:"result"`
	Summary              string              `json:"summary"`
	Steps                []string            `json:"steps"`
	ExpectedChangedPaths []string            `json:"expected_changed_paths"`
	NonGoals             []string            `json:"non_goals"`
	VerificationSteps    []string            `json:"verification_steps"`
	UnresolvedQuestions  []string            `json:"unresolved_questions"`
}

func (PlanChangePayload) actionPayload() {}

type ImplementChangePayload struct {
	Result         domain.ActionResult `json:"result"`
	Summary        string              `json:"summary"`
	ChangedPaths   []string            `json:"changed_paths"`
	NoFileChanges  bool                `json:"no_file_changes"`
	Deviations     []string            `json:"deviations"`
	ScopeConfirmed bool                `json:"scope_confirmed"`
}

func (ImplementChangePayload) actionPayload() {}

// EvidenceInput contains only caller-owned evidence data. Evidence identity,
// digest, task/action identity, and recording time remain Core-owned.
type EvidenceInput struct {
	Source       domain.EvidenceSource `json:"source"`
	Name         string                `json:"name"`
	Status       domain.EvidenceStatus `json:"status"`
	Summary      string                `json:"summary"`
	CommandCount int                   `json:"command_count"`
	FullSuite    bool                  `json:"full_suite"`
}

type VerifyChangePayload struct {
	Result             domain.ActionResult `json:"result"`
	Summary            string              `json:"summary"`
	Checks             []EvidenceInput     `json:"checks"`
	FailedItems        []string            `json:"failed_items"`
	UnverifiedItems    []string            `json:"unverified_items"`
	ManualHandoffItems []string            `json:"manual_handoff_items"`
	Reason             string              `json:"reason"`
}

func (VerifyChangePayload) actionPayload() {}

type ReviewChangePayload struct {
	Result        domain.ActionResult `json:"result"`
	Summary       string              `json:"summary"`
	Findings      []string            `json:"findings"`
	ResidualRisks []string            `json:"residual_risks"`
	Reason        string              `json:"reason"`
}

func (ReviewChangePayload) actionPayload() {}

// DeliveryData is the one typed acceptance/evidence projection shared by the
// REVIEW and HANDOFF payloads. It never copies EvidenceSummary values.
type DeliveryData struct {
	Acceptance           []domain.OutcomeCriterion `json:"acceptance"`
	AutomatedEvidenceIDs []domain.ID               `json:"automated_evidence_ids"`
	ManualEvidenceIDs    []domain.ID               `json:"manual_evidence_ids"`
	UnverifiedItems      []string                  `json:"unverified_items"`
	Risks                []string                  `json:"risks"`
}

type ReviewHandoffPayload struct {
	Result   domain.ActionResult `json:"result"`
	Summary  string              `json:"summary"`
	Delivery *DeliveryData       `json:"delivery"`
	Reason   string              `json:"reason"`
}

func (ReviewHandoffPayload) actionPayload() {}

type CompleteHandoffPayload struct {
	Result   domain.ActionResult `json:"result"`
	Summary  string              `json:"summary"`
	Delivery *DeliveryData       `json:"delivery"`
	Reason   string              `json:"reason"`
}

func (CompleteHandoffPayload) actionPayload() {}

type BlockerResolutionEvidence struct {
	Condition             domain.BlockerCondition `json:"condition"`
	ObservedBindingDigest domain.Digest           `json:"observed_binding_digest"`
}

type ResolveBlockerPayload struct {
	Result             domain.ActionResult       `json:"result"`
	BlockerID          domain.ID                 `json:"blocker_id"`
	Summary            string                    `json:"summary"`
	ResolutionEvidence BlockerResolutionEvidence `json:"resolution_evidence"`
}

func (ResolveBlockerPayload) actionPayload() {}

// NormalizedEvidenceInput is a validated, caller-identity-free evidence
// summary ready for budget evaluation and Core-owned persistence.
type NormalizedEvidenceInput struct {
	Source       domain.EvidenceSource `json:"source"`
	Name         string                `json:"name"`
	Status       domain.EvidenceStatus `json:"status"`
	Summary      string                `json:"summary"`
	CommandCount int                   `json:"command_count"`
	FullSuite    bool                  `json:"full_suite"`
}

// RepositoryEffectExpectation is the closed repository fact claimed by a
// validated payload. Recovery consumes this derived value instead of parsing
// payload JSON or repeating phase-specific payload rules.
type RepositoryEffectExpectation string

const (
	RepositoryEffectExactBinding            RepositoryEffectExpectation = "exact_binding"
	RepositoryEffectWorktreeOnlyChange      RepositoryEffectExpectation = "worktree_only_change"
	RepositoryEffectExactBlockerRestoration RepositoryEffectExpectation = "exact_blocker_restoration"
)

func (e RepositoryEffectExpectation) IsValid() bool {
	return e == RepositoryEffectExactBinding || e == RepositoryEffectWorktreeOnlyChange ||
		e == RepositoryEffectExactBlockerRestoration
}

// ValidatedPayload is the normalized result of the closed payload contract.
// CanonicalBytes are compact JSON with HTML escaping disabled and no newline.
type ValidatedPayload struct {
	Result             domain.ActionResult
	Reason             string
	Summary            string
	Checks             []NormalizedEvidenceInput
	ManualHandoffItems []string
	Delivery           *DeliveryData
	BlockerResolution  *ValidatedBlockerResolution
	RepositoryEffect   RepositoryEffectExpectation
	CanonicalBytes     []byte
}

type ValidatedBlockerResolution struct {
	BlockerID             domain.ID
	Condition             domain.BlockerCondition
	ObservedBindingDigest domain.Digest
}

// ValidatePayload matches the exact source phase and action to its one closed
// payload type, normalizes bounded text, and enforces result-specific rules.
func ValidatePayload(
	phase domain.Phase,
	action domain.ActionKind,
	payload ActionPayload,
) (ValidatedPayload, error) {
	if (!phase.NormalNonTerminal() && phase != domain.PhaseBlocked) || !action.IsValid() || payload == nil {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	expectedAction, ok := ActionForPhase(phase)
	if !ok || expectedAction != action {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}

	switch phase {
	case domain.PhaseIntake:
		value, ok := assessPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateAssessPayload(value)
	case domain.PhaseAssess:
		value, ok := planPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validatePlanPayload(value)
	case domain.PhasePlan:
		value, ok := implementPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateImplementPayload(value)
	case domain.PhaseImplement:
		value, ok := verifyPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateVerifyPayload(value)
	case domain.PhaseVerify:
		value, ok := reviewPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateReviewPayload(value)
	case domain.PhaseReview:
		value, ok := reviewHandoffPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateReviewHandoffPayload(value)
	case domain.PhaseHandoff:
		value, ok := completeHandoffPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateCompleteHandoffPayload(value)
	case domain.PhaseBlocked:
		value, ok := resolveBlockerPayloadValue(payload)
		if !ok {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
		return validateResolveBlockerPayload(value)
	default:
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
}

func validateResolveBlockerPayload(payload ResolveBlockerPayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultSucceeded || !payload.BlockerID.IsValid() ||
		payload.ResolutionEvidence.Condition.Validate() != nil ||
		!payload.ResolutionEvidence.ObservedBindingDigest.IsValid() {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	normalized := ResolveBlockerPayload{
		Result:    payload.Result,
		BlockerID: payload.BlockerID,
		Summary:   summary,
		ResolutionEvidence: BlockerResolutionEvidence{
			Condition:             payload.ResolutionEvidence.Condition,
			ObservedBindingDigest: payload.ResolutionEvidence.ObservedBindingDigest,
		},
	}
	return finishValidatedPayload(normalized, ValidatedPayload{
		Result:  payload.Result,
		Summary: summary,
		BlockerResolution: &ValidatedBlockerResolution{
			BlockerID:             payload.BlockerID,
			Condition:             payload.ResolutionEvidence.Condition,
			ObservedBindingDigest: payload.ResolutionEvidence.ObservedBindingDigest,
		},
	})
}

func validateAssessPayload(payload AssessTaskPayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultSucceeded || !payload.VerificationBudgetAcknowledged {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	constraints, err := normalizePayloadList(payload.Constraints, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	risks, err := normalizePayloadList(payload.Risks, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	surface, err := normalizePayloadList(payload.IntendedChangedSurface, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	normalized := AssessTaskPayload{
		Result:                         payload.Result,
		Summary:                        summary,
		Constraints:                    constraints,
		Risks:                          risks,
		IntendedChangedSurface:         surface,
		VerificationBudgetAcknowledged: true,
	}
	return finishValidatedPayload(normalized, ValidatedPayload{Result: payload.Result, Summary: summary})
}

func validatePlanPayload(payload PlanChangePayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultSucceeded {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	steps, err := normalizePayloadList(payload.Steps, true)
	if err != nil {
		return ValidatedPayload{}, err
	}
	paths, err := normalizePayloadList(payload.ExpectedChangedPaths, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	nonGoals, err := normalizePayloadList(payload.NonGoals, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	verification, err := normalizePayloadList(payload.VerificationSteps, true)
	if err != nil {
		return ValidatedPayload{}, err
	}
	questions, err := normalizePayloadList(payload.UnresolvedQuestions, false)
	if err != nil || len(questions) != 0 {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	normalized := PlanChangePayload{
		Result:               payload.Result,
		Summary:              summary,
		Steps:                steps,
		ExpectedChangedPaths: paths,
		NonGoals:             nonGoals,
		VerificationSteps:    verification,
		UnresolvedQuestions:  questions,
	}
	return finishValidatedPayload(normalized, ValidatedPayload{Result: payload.Result, Summary: summary})
}

func validateImplementPayload(payload ImplementChangePayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultSucceeded || !payload.ScopeConfirmed {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	changedPaths, err := normalizeChangedPaths(payload.ChangedPaths)
	if err != nil || (len(changedPaths) > 0) == payload.NoFileChanges {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	deviations, err := normalizePayloadList(payload.Deviations, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	normalized := ImplementChangePayload{
		Result:         payload.Result,
		Summary:        summary,
		ChangedPaths:   changedPaths,
		NoFileChanges:  payload.NoFileChanges,
		Deviations:     deviations,
		ScopeConfirmed: true,
	}
	return finishValidatedPayload(normalized, ValidatedPayload{Result: payload.Result, Summary: summary})
}

func validateVerifyPayload(payload VerifyChangePayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultReady && payload.Result != domain.ActionResultFailed {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	checks, err := normalizeEvidenceInputs(payload.Checks)
	if err != nil {
		return ValidatedPayload{}, err
	}
	failedItems, err := normalizePayloadList(payload.FailedItems, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	unverifiedItems, err := normalizePayloadList(payload.UnverifiedItems, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	manualItems, err := normalizePayloadList(payload.ManualHandoffItems, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	reason, err := normalizeOptionalPayloadText(payload.Reason, domain.MaxReasonBytes)
	if err != nil {
		return ValidatedPayload{}, err
	}
	if payload.Result == domain.ActionResultReady {
		if len(failedItems) != 0 || reason != "" {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
	} else {
		if reason == "" || (len(failedItems) == 0 && !containsFailedCheck(checks)) {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
	}
	evidenceCount := 1 + len(checks)
	if reason != "" {
		evidenceCount++
	}
	if evidenceCount > domain.MaxEvidencePerAction {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	normalizedChecks := evidenceInputsFromNormalized(checks)
	normalized := VerifyChangePayload{
		Result:             payload.Result,
		Summary:            summary,
		Checks:             normalizedChecks,
		FailedItems:        failedItems,
		UnverifiedItems:    unverifiedItems,
		ManualHandoffItems: manualItems,
		Reason:             reason,
	}
	return finishValidatedPayload(normalized, ValidatedPayload{
		Result:             payload.Result,
		Summary:            summary,
		Reason:             reason,
		Checks:             append([]NormalizedEvidenceInput(nil), checks...),
		ManualHandoffItems: append([]string(nil), manualItems...),
	})
}

func validateReviewPayload(payload ReviewChangePayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultPass &&
		payload.Result != domain.ActionResultReworkImplementation &&
		payload.Result != domain.ActionResultReplan {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	summary, err := normalizePayloadSummary(payload.Summary)
	if err != nil {
		return ValidatedPayload{}, err
	}
	findings, err := normalizePayloadList(payload.Findings, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	risks, err := normalizePayloadList(payload.ResidualRisks, false)
	if err != nil {
		return ValidatedPayload{}, err
	}
	reason, err := normalizeOptionalPayloadText(payload.Reason, domain.MaxReasonBytes)
	if err != nil || (payload.Result == domain.ActionResultPass && reason != "") ||
		(payload.Result != domain.ActionResultPass && reason == "") {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	normalized := ReviewChangePayload{
		Result:        payload.Result,
		Summary:       summary,
		Findings:      findings,
		ResidualRisks: risks,
		Reason:        reason,
	}
	return finishValidatedPayload(normalized, ValidatedPayload{Result: payload.Result, Summary: summary, Reason: reason})
}

func validateReviewHandoffPayload(payload ReviewHandoffPayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultReady &&
		payload.Result != domain.ActionResultReworkImplementation &&
		payload.Result != domain.ActionResultReplan {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	return validateHandoffPayload(
		payload.Result,
		payload.Summary,
		payload.Delivery,
		payload.Reason,
		func(summary string, delivery *DeliveryData, reason string) ActionPayload {
			return ReviewHandoffPayload{Result: payload.Result, Summary: summary, Delivery: delivery, Reason: reason}
		},
	)
}

func validateCompleteHandoffPayload(payload CompleteHandoffPayload) (ValidatedPayload, error) {
	if payload.Result != domain.ActionResultComplete &&
		payload.Result != domain.ActionResultReworkImplementation &&
		payload.Result != domain.ActionResultReplan {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	return validateHandoffPayload(
		payload.Result,
		payload.Summary,
		payload.Delivery,
		payload.Reason,
		func(summary string, delivery *DeliveryData, reason string) ActionPayload {
			return CompleteHandoffPayload{Result: payload.Result, Summary: summary, Delivery: delivery, Reason: reason}
		},
	)
}

func validateHandoffPayload(
	result domain.ActionResult,
	summaryText string,
	deliveryInput *DeliveryData,
	reasonText string,
	build func(string, *DeliveryData, string) ActionPayload,
) (ValidatedPayload, error) {
	summary, err := normalizePayloadSummary(summaryText)
	if err != nil {
		return ValidatedPayload{}, err
	}
	reason, err := normalizeOptionalPayloadText(reasonText, domain.MaxReasonBytes)
	if err != nil {
		return ValidatedPayload{}, err
	}
	ready := result == domain.ActionResultReady || result == domain.ActionResultComplete
	if ready {
		if deliveryInput == nil || reason != "" {
			return ValidatedPayload{}, domain.ErrInvalidArgument
		}
	} else if deliveryInput != nil || reason == "" {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	var delivery *DeliveryData
	if deliveryInput != nil {
		normalized, err := normalizeDeliveryData(*deliveryInput)
		if err != nil {
			return ValidatedPayload{}, err
		}
		delivery = &normalized
	}
	canonicalPayload := build(summary, delivery, reason)
	return finishValidatedPayload(canonicalPayload, ValidatedPayload{
		Result:   result,
		Summary:  summary,
		Reason:   reason,
		Delivery: cloneDeliveryPointer(delivery),
	})
}

// ValidateDelivery binds normalized delivery data to the immutable task
// contract and the task's sole retained evidence authority.
func ValidateDelivery(
	delivery DeliveryData,
	contract domain.Contract,
	evidence []domain.EvidenceSummary,
) error {
	normalized, err := normalizeDeliveryData(delivery)
	if err != nil || !sameDeliveryData(delivery, normalized) || contract.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	criteria := contract.AcceptanceCriteria()
	if len(normalized.Acceptance) != len(criteria) {
		return domain.ErrInvalidArgument
	}
	for i := range criteria {
		if normalized.Acceptance[i].Criterion != criteria[i] {
			return domain.ErrInvalidArgument
		}
	}

	evidenceByID := make(map[domain.ID]domain.EvidenceSummary, len(evidence))
	for _, item := range evidence {
		if item.Validate() != nil {
			return domain.ErrInvalidArgument
		}
		if _, duplicate := evidenceByID[item.EvidenceID]; duplicate {
			return domain.ErrInvalidArgument
		}
		evidenceByID[item.EvidenceID] = item
	}
	for _, evidenceID := range normalized.AutomatedEvidenceIDs {
		item, exists := evidenceByID[evidenceID]
		if !exists || item.Source != domain.EvidenceSourceAutomated {
			return domain.ErrInvalidArgument
		}
	}
	if len(normalized.ManualEvidenceIDs) != 0 && !contract.VerificationBudget().AllowManualHandoff {
		return domain.ErrInvalidArgument
	}
	for _, evidenceID := range normalized.ManualEvidenceIDs {
		item, exists := evidenceByID[evidenceID]
		if !exists || item.Source != domain.EvidenceSourceUser {
			return domain.ErrInvalidArgument
		}
	}
	return nil
}

func normalizeDeliveryData(delivery DeliveryData) (DeliveryData, error) {
	if len(delivery.Acceptance) == 0 || len(delivery.Acceptance) > domain.MaxAcceptanceCriteriaItems ||
		len(delivery.AutomatedEvidenceIDs)+len(delivery.ManualEvidenceIDs) > domain.MaxRetainedEvidenceItems {
		return DeliveryData{}, domain.ErrInvalidArgument
	}
	acceptance := make([]domain.OutcomeCriterion, len(delivery.Acceptance))
	criteria := make(map[string]struct{}, len(delivery.Acceptance))
	for i, criterion := range delivery.Acceptance {
		text, err := normalizeRequiredPayloadText(criterion.Criterion, domain.MaxAcceptanceCriterionBytes)
		if err != nil || !criterion.Status.IsValid() {
			return DeliveryData{}, domain.ErrInvalidArgument
		}
		if _, duplicate := criteria[text]; duplicate {
			return DeliveryData{}, domain.ErrInvalidArgument
		}
		criteria[text] = struct{}{}
		acceptance[i] = domain.OutcomeCriterion{Criterion: text, Status: criterion.Status}
	}
	automatedIDs, seen, err := normalizeEvidenceIDs(delivery.AutomatedEvidenceIDs, nil)
	if err != nil {
		return DeliveryData{}, err
	}
	manualIDs, _, err := normalizeEvidenceIDs(delivery.ManualEvidenceIDs, seen)
	if err != nil {
		return DeliveryData{}, err
	}
	unverified, err := normalizePayloadList(delivery.UnverifiedItems, false)
	if err != nil {
		return DeliveryData{}, err
	}
	risks, err := normalizePayloadList(delivery.Risks, false)
	if err != nil {
		return DeliveryData{}, err
	}
	return DeliveryData{
		Acceptance:           acceptance,
		AutomatedEvidenceIDs: automatedIDs,
		ManualEvidenceIDs:    manualIDs,
		UnverifiedItems:      unverified,
		Risks:                risks,
	}, nil
}

func normalizeEvidenceIDs(values []domain.ID, seen map[domain.ID]struct{}) ([]domain.ID, map[domain.ID]struct{}, error) {
	if seen == nil {
		seen = make(map[domain.ID]struct{}, len(values))
	}
	result := make([]domain.ID, len(values))
	for i, value := range values {
		if !value.IsValid() {
			return nil, nil, domain.ErrInvalidArgument
		}
		if _, duplicate := seen[value]; duplicate {
			return nil, nil, domain.ErrInvalidArgument
		}
		seen[value] = struct{}{}
		result[i] = value
	}
	return result, seen, nil
}

func normalizeEvidenceInputs(inputs []EvidenceInput) ([]NormalizedEvidenceInput, error) {
	if len(inputs) > domain.MaxEvidencePerAction {
		return nil, domain.ErrInvalidArgument
	}
	result := make([]NormalizedEvidenceInput, len(inputs))
	seen := make(map[string]struct{}, len(inputs))
	for i, input := range inputs {
		name, err := normalizeRequiredPayloadText(input.Name, domain.MaxEvidenceNameBytes)
		if err != nil {
			return nil, err
		}
		summary, err := normalizeRequiredPayloadText(input.Summary, domain.MaxEvidenceSummaryBytes)
		if err != nil || !input.Source.IsValid() || !input.Status.IsValid() ||
			input.CommandCount < 0 || input.CommandCount > domain.MaxAutomaticVerificationCommands ||
			(input.Source != domain.EvidenceSourceAutomated && (input.CommandCount != 0 || input.FullSuite)) {
			return nil, domain.ErrInvalidArgument
		}
		if _, duplicate := seen[name]; duplicate {
			return nil, domain.ErrInvalidArgument
		}
		seen[name] = struct{}{}
		result[i] = NormalizedEvidenceInput{
			Source:       input.Source,
			Name:         name,
			Status:       input.Status,
			Summary:      summary,
			CommandCount: input.CommandCount,
			FullSuite:    input.FullSuite,
		}
	}
	return result, nil
}

func evidenceInputsFromNormalized(inputs []NormalizedEvidenceInput) []EvidenceInput {
	result := make([]EvidenceInput, len(inputs))
	for i, input := range inputs {
		result[i] = EvidenceInput{
			Source:       input.Source,
			Name:         input.Name,
			Status:       input.Status,
			Summary:      input.Summary,
			CommandCount: input.CommandCount,
			FullSuite:    input.FullSuite,
		}
	}
	return result
}

func containsFailedCheck(checks []NormalizedEvidenceInput) bool {
	for _, check := range checks {
		if check.Status == domain.EvidenceFailed {
			return true
		}
	}
	return false
}

func finishValidatedPayload(canonicalValue any, validated ValidatedPayload) (ValidatedPayload, error) {
	encoded, err := compactPayloadJSON(canonicalValue)
	if err != nil || len(encoded) > domain.MaxActionPayloadBytes {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	effect, ok := repositoryEffectForPayload(canonicalValue)
	if !ok {
		return ValidatedPayload{}, domain.ErrInvalidArgument
	}
	validated.RepositoryEffect = effect
	validated.CanonicalBytes = append([]byte(nil), encoded...)
	validated.Checks = append([]NormalizedEvidenceInput(nil), validated.Checks...)
	validated.ManualHandoffItems = append([]string(nil), validated.ManualHandoffItems...)
	validated.Delivery = cloneDeliveryPointer(validated.Delivery)
	if validated.BlockerResolution != nil {
		resolution := *validated.BlockerResolution
		validated.BlockerResolution = &resolution
	}
	return validated, nil
}

func repositoryEffectForPayload(canonicalValue any) (RepositoryEffectExpectation, bool) {
	switch payload := canonicalValue.(type) {
	case AssessTaskPayload, PlanChangePayload, VerifyChangePayload, ReviewChangePayload,
		ReviewHandoffPayload, CompleteHandoffPayload:
		return RepositoryEffectExactBinding, true
	case ImplementChangePayload:
		if payload.NoFileChanges {
			return RepositoryEffectExactBinding, true
		}
		return RepositoryEffectWorktreeOnlyChange, true
	case ResolveBlockerPayload:
		return RepositoryEffectExactBlockerRestoration, true
	default:
		return "", false
	}
}

func compactPayloadJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, domain.ErrInvalidArgument
	}
	encoded := buffer.Bytes()
	if len(encoded) == 0 || encoded[len(encoded)-1] != '\n' {
		return nil, domain.ErrInvalidArgument
	}
	return append([]byte(nil), encoded[:len(encoded)-1]...), nil
}

func normalizePayloadSummary(value string) (string, error) {
	return normalizeRequiredPayloadText(value, domain.MaxEvidenceSummaryBytes)
}

func normalizeRequiredPayloadText(value string, maxBytes int) (string, error) {
	if !utf8.ValidString(value) {
		return "", domain.ErrInvalidArgument
	}
	value = strings.TrimSpace(value)
	if value == "" || len(value) > maxBytes {
		return "", domain.ErrInvalidArgument
	}
	return value, nil
}

func normalizeOptionalPayloadText(value string, maxBytes int) (string, error) {
	if !utf8.ValidString(value) {
		return "", domain.ErrInvalidArgument
	}
	value = strings.TrimSpace(value)
	if len(value) > maxBytes {
		return "", domain.ErrInvalidArgument
	}
	return value, nil
}

func normalizePayloadList(values []string, required bool) ([]string, error) {
	if len(values) > domain.MaxBoundedStringListItems || (required && len(values) == 0) {
		return nil, domain.ErrInvalidArgument
	}
	result := make([]string, len(values))
	seen := make(map[string]struct{}, len(values))
	for i, value := range values {
		normalized, err := normalizeRequiredPayloadText(value, domain.MaxReasonBytes)
		if err != nil {
			return nil, err
		}
		if _, duplicate := seen[normalized]; duplicate {
			return nil, domain.ErrInvalidArgument
		}
		seen[normalized] = struct{}{}
		result[i] = normalized
	}
	return result, nil
}

func normalizeChangedPaths(values []string) ([]string, error) {
	if len(values) > domain.MaxBoundedStringListItems {
		return nil, domain.ErrInvalidArgument
	}
	result := make([]string, len(values))
	seen := make(map[string]struct{}, len(values))
	for i, value := range values {
		normalized, err := normalizeRequiredPayloadText(value, domain.MaxRepositoryPathBytes)
		if err != nil || !repositoryRelativePath(normalized) {
			return nil, domain.ErrInvalidArgument
		}
		if _, duplicate := seen[normalized]; duplicate {
			return nil, domain.ErrInvalidArgument
		}
		seen[normalized] = struct{}{}
		result[i] = normalized
	}
	return result, nil
}

func repositoryRelativePath(value string) bool {
	if value == "." || path.IsAbs(value) || filepath.IsAbs(value) || filepath.VolumeName(value) != "" ||
		windowsAbsolutePath(value) {
		return false
	}
	for _, component := range strings.Split(filepath.ToSlash(value), "/") {
		if component == ".." {
			return false
		}
	}
	return true
}

func windowsAbsolutePath(value string) bool {
	if strings.HasPrefix(value, `\\`) || strings.HasPrefix(value, "//") {
		return true
	}
	return len(value) >= 3 && ((value[0] >= 'a' && value[0] <= 'z') ||
		(value[0] >= 'A' && value[0] <= 'Z')) && value[1] == ':' &&
		(value[2] == '\\' || value[2] == '/')
}

func cloneDeliveryPointer(value *DeliveryData) *DeliveryData {
	if value == nil {
		return nil
	}
	clone := DeliveryData{
		Acceptance:           append([]domain.OutcomeCriterion(nil), value.Acceptance...),
		AutomatedEvidenceIDs: append([]domain.ID(nil), value.AutomatedEvidenceIDs...),
		ManualEvidenceIDs:    append([]domain.ID(nil), value.ManualEvidenceIDs...),
		UnverifiedItems:      append([]string(nil), value.UnverifiedItems...),
		Risks:                append([]string(nil), value.Risks...),
	}
	if clone.Acceptance == nil {
		clone.Acceptance = []domain.OutcomeCriterion{}
	}
	if clone.AutomatedEvidenceIDs == nil {
		clone.AutomatedEvidenceIDs = []domain.ID{}
	}
	if clone.ManualEvidenceIDs == nil {
		clone.ManualEvidenceIDs = []domain.ID{}
	}
	if clone.UnverifiedItems == nil {
		clone.UnverifiedItems = []string{}
	}
	if clone.Risks == nil {
		clone.Risks = []string{}
	}
	return &clone
}

func sameDeliveryData(left, right DeliveryData) bool {
	if len(left.Acceptance) != len(right.Acceptance) ||
		len(left.AutomatedEvidenceIDs) != len(right.AutomatedEvidenceIDs) ||
		len(left.ManualEvidenceIDs) != len(right.ManualEvidenceIDs) ||
		len(left.UnverifiedItems) != len(right.UnverifiedItems) || len(left.Risks) != len(right.Risks) {
		return false
	}
	for i := range left.Acceptance {
		if left.Acceptance[i] != right.Acceptance[i] {
			return false
		}
	}
	for i := range left.AutomatedEvidenceIDs {
		if left.AutomatedEvidenceIDs[i] != right.AutomatedEvidenceIDs[i] {
			return false
		}
	}
	for i := range left.ManualEvidenceIDs {
		if left.ManualEvidenceIDs[i] != right.ManualEvidenceIDs[i] {
			return false
		}
	}
	for i := range left.UnverifiedItems {
		if left.UnverifiedItems[i] != right.UnverifiedItems[i] {
			return false
		}
	}
	for i := range left.Risks {
		if left.Risks[i] != right.Risks[i] {
			return false
		}
	}
	return true
}

func assessPayloadValue(payload ActionPayload) (AssessTaskPayload, bool) {
	switch value := payload.(type) {
	case AssessTaskPayload:
		return value, true
	case *AssessTaskPayload:
		if value != nil {
			return *value, true
		}
	}
	return AssessTaskPayload{}, false
}

func planPayloadValue(payload ActionPayload) (PlanChangePayload, bool) {
	switch value := payload.(type) {
	case PlanChangePayload:
		return value, true
	case *PlanChangePayload:
		if value != nil {
			return *value, true
		}
	}
	return PlanChangePayload{}, false
}

func implementPayloadValue(payload ActionPayload) (ImplementChangePayload, bool) {
	switch value := payload.(type) {
	case ImplementChangePayload:
		return value, true
	case *ImplementChangePayload:
		if value != nil {
			return *value, true
		}
	}
	return ImplementChangePayload{}, false
}

func verifyPayloadValue(payload ActionPayload) (VerifyChangePayload, bool) {
	switch value := payload.(type) {
	case VerifyChangePayload:
		return value, true
	case *VerifyChangePayload:
		if value != nil {
			return *value, true
		}
	}
	return VerifyChangePayload{}, false
}

func reviewPayloadValue(payload ActionPayload) (ReviewChangePayload, bool) {
	switch value := payload.(type) {
	case ReviewChangePayload:
		return value, true
	case *ReviewChangePayload:
		if value != nil {
			return *value, true
		}
	}
	return ReviewChangePayload{}, false
}

func reviewHandoffPayloadValue(payload ActionPayload) (ReviewHandoffPayload, bool) {
	switch value := payload.(type) {
	case ReviewHandoffPayload:
		return value, true
	case *ReviewHandoffPayload:
		if value != nil {
			return *value, true
		}
	}
	return ReviewHandoffPayload{}, false
}

func completeHandoffPayloadValue(payload ActionPayload) (CompleteHandoffPayload, bool) {
	switch value := payload.(type) {
	case CompleteHandoffPayload:
		return value, true
	case *CompleteHandoffPayload:
		if value != nil {
			return *value, true
		}
	}
	return CompleteHandoffPayload{}, false
}

func resolveBlockerPayloadValue(payload ActionPayload) (ResolveBlockerPayload, bool) {
	switch value := payload.(type) {
	case ResolveBlockerPayload:
		return value, true
	case *ResolveBlockerPayload:
		if value != nil {
			return *value, true
		}
	}
	return ResolveBlockerPayload{}, false
}
