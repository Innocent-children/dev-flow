package mcp

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type openTaskWireInput struct {
	Host           domain.Host     `json:"host"`
	RepositoryPath string          `json:"repository_path"`
	NewTask        json.RawMessage `json:"new_task"`
}

type newTaskWireInput struct {
	Goal               string          `json:"goal"`
	Scope              []string        `json:"scope"`
	OutOfScope         []string        `json:"out_of_scope"`
	AcceptanceCriteria []string        `json:"acceptance_criteria"`
	VerificationBudget json.RawMessage `json:"verification_budget"`
}

type readTaskWireInput struct {
	Host           domain.Host     `json:"host"`
	TaskID         domain.ID       `json:"task_id"`
	OperationProbe json.RawMessage `json:"operation_probe"`
}

type operationProbeWireInput struct {
	OperationID             domain.ID         `json:"operation_id"`
	SourcePhase             domain.Phase      `json:"source_phase"`
	ExpectedRevision        uint64            `json:"expected_revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
}

type applyActionWireInput struct {
	RequestID               domain.ID         `json:"request_id"`
	Host                    domain.Host       `json:"host"`
	TaskID                  domain.ID         `json:"task_id"`
	Revision                uint64            `json:"revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
	RecoveryApply           json.RawMessage   `json:"recovery_apply"`
}

type recoveryApplyWireInput struct {
	OperationID domain.ID    `json:"operation_id"`
	SourcePhase domain.Phase `json:"source_phase"`
}

type cancelTaskWireInput struct {
	Host     domain.Host `json:"host"`
	TaskID   domain.ID   `json:"task_id"`
	Revision uint64      `json:"revision"`
	Reason   string      `json:"reason"`
}

type verifyPayloadWire struct {
	Result             domain.ActionResult `json:"result"`
	Summary            string              `json:"summary"`
	Checks             []json.RawMessage   `json:"checks"`
	FailedItems        []string            `json:"failed_items"`
	UnverifiedItems    []string            `json:"unverified_items"`
	ManualHandoffItems []string            `json:"manual_handoff_items"`
	Reason             string              `json:"reason"`
}

type handoffPayloadWire struct {
	Result   domain.ActionResult `json:"result"`
	Summary  string              `json:"summary"`
	Delivery json.RawMessage     `json:"delivery"`
	Reason   string              `json:"reason"`
}

type deliveryWire struct {
	Acceptance           []json.RawMessage `json:"acceptance"`
	AutomatedEvidenceIDs []domain.ID       `json:"automated_evidence_ids"`
	ManualEvidenceIDs    []domain.ID       `json:"manual_evidence_ids"`
	UnverifiedItems      []string          `json:"unverified_items"`
	Risks                []string          `json:"risks"`
}

type blockerResolutionWire struct {
	Condition             json.RawMessage `json:"condition"`
	ObservedBindingDigest domain.Digest   `json:"observed_binding_digest"`
}

type resolveBlockerPayloadWire struct {
	Result             domain.ActionResult `json:"result"`
	BlockerID          domain.ID           `json:"blocker_id"`
	Summary            string              `json:"summary"`
	ResolutionEvidence json.RawMessage     `json:"resolution_evidence"`
}

// ValidateToolInput exercises the same closed decoder used by raw SDK tool
// handlers without dispatching to Application.
func ValidateToolInput(tool string, raw []byte) error {
	switch tool {
	case ToolServerInfo:
		return decodeServerInfoInput(raw)
	case ToolOpenTask:
		_, err := decodeOpenTaskInput(raw, "request-contract-validation")
		return err
	case ToolGetTask, ToolGetNextAction:
		_, err := decodeReadTaskInput(raw)
		return err
	case ToolApplyAction:
		wire, err := decodeApplyActionWire(raw)
		if err != nil {
			return err
		}
		phase, err := inferredPayloadPhase(wire)
		if err != nil {
			return err
		}
		_, err = finishApplyActionInput(wire, phase)
		return err
	case ToolCancelTask:
		_, err := decodeCancelTaskInput(raw, "request-contract-validation")
		return err
	default:
		return domain.ErrInvalidArgument
	}
}

func decodeServerInfoInput(raw []byte) error {
	if err := requireObjectMembers(raw); err != nil {
		return err
	}
	var input struct{}
	return decodeClosed(raw, &input)
}

func decodeOpenTaskInput(raw []byte, requestID domain.ID) (application.OpenTaskRequest, error) {
	if err := requireObjectMembers(raw, "host", "repository_path"); err != nil {
		return application.OpenTaskRequest{}, err
	}
	var wire openTaskWireInput
	if err := decodeClosed(raw, &wire); err != nil || !wire.Host.IsValid() ||
		!validRequiredBytes(wire.RepositoryPath, domain.MaxRepositoryPathBytes) || !requestID.IsValid() {
		return application.OpenTaskRequest{}, domain.ErrInvalidArgument
	}
	result := application.OpenTaskRequest{
		RequestID:      requestID,
		Host:           wire.Host,
		RepositoryPath: wire.RepositoryPath,
	}
	if len(wire.NewTask) == 0 || isJSONNull(wire.NewTask) {
		return result, nil
	}
	newTask, err := decodeNewTaskInput(wire.NewTask)
	if err != nil {
		return application.OpenTaskRequest{}, err
	}
	result.NewTask = &newTask
	return result, nil
}

func decodeNewTaskInput(raw []byte) (application.NewTaskInput, error) {
	if err := requireObjectMembers(raw, "goal", "scope", "out_of_scope", "acceptance_criteria", "verification_budget"); err != nil {
		return application.NewTaskInput{}, err
	}
	var wire newTaskWireInput
	if err := decodeClosed(raw, &wire); err != nil {
		return application.NewTaskInput{}, domain.ErrInvalidArgument
	}
	if err := requireObjectMembers(wire.VerificationBudget, "level", "max_automatic_commands", "allow_full_suite", "allow_manual_handoff"); err != nil {
		return application.NewTaskInput{}, err
	}
	var budget domain.VerificationBudget
	if err := decodeClosed(wire.VerificationBudget, &budget); err != nil {
		return application.NewTaskInput{}, domain.ErrInvalidArgument
	}
	contract, err := domain.NewContract(wire.Goal, wire.Scope, wire.OutOfScope, wire.AcceptanceCriteria, budget)
	if err != nil {
		return application.NewTaskInput{}, domain.ErrInvalidArgument
	}
	return application.NewTaskInput{
		Goal:               contract.Goal(),
		Scope:              contract.Scope(),
		OutOfScope:         contract.OutOfScope(),
		AcceptanceCriteria: contract.AcceptanceCriteria(),
		VerificationBudget: contract.VerificationBudget(),
	}, nil
}

func decodeReadTaskInput(raw []byte) (readTaskWireInput, error) {
	if err := requireObjectMembers(raw, "host", "task_id"); err != nil {
		return readTaskWireInput{}, err
	}
	var wire readTaskWireInput
	if err := decodeClosed(raw, &wire); err != nil || !wire.Host.IsValid() || !wire.TaskID.IsValid() {
		return readTaskWireInput{}, domain.ErrInvalidArgument
	}
	if len(wire.OperationProbe) != 0 && !isJSONNull(wire.OperationProbe) {
		if _, err := decodeOperationProbe(wire.OperationProbe); err != nil {
			return readTaskWireInput{}, err
		}
	}
	return wire, nil
}

func convertReadTaskInput(wire readTaskWireInput) (domain.Host, domain.ID, *application.OperationProbe, error) {
	if len(wire.OperationProbe) == 0 || isJSONNull(wire.OperationProbe) {
		return wire.Host, wire.TaskID, nil, nil
	}
	probe, err := decodeOperationProbe(wire.OperationProbe)
	if err != nil {
		return "", "", nil, err
	}
	return wire.Host, wire.TaskID, &probe, nil
}

func decodeOperationProbe(raw []byte) (application.OperationProbe, error) {
	if err := requireObjectMembers(raw, "operation_id", "source_phase", "expected_revision", "action_id", "action_kind", "repository_binding_digest", "payload"); err != nil {
		return application.OperationProbe{}, err
	}
	var wire operationProbeWireInput
	if err := decodeClosed(raw, &wire); err != nil || !wire.OperationID.IsValid() ||
		(!wire.SourcePhase.NormalNonTerminal() && wire.SourcePhase != domain.PhaseBlocked) ||
		wire.ExpectedRevision == 0 || !wire.ActionID.IsValid() || !wire.ActionKind.IsValid() ||
		!wire.RepositoryBindingDigest.IsValid() || !phaseAcceptsAction(wire.SourcePhase, wire.ActionKind) {
		return application.OperationProbe{}, domain.ErrInvalidArgument
	}
	var payload workflow.ActionPayload
	if !isJSONNull(wire.Payload) {
		var err error
		payload, err = decodeActionPayload(wire.Payload, wire.SourcePhase, wire.ActionKind)
		if err != nil {
			return application.OperationProbe{}, err
		}
	}
	return application.OperationProbe{
		OperationID:             wire.OperationID,
		SourcePhase:             wire.SourcePhase,
		ExpectedRevision:        wire.ExpectedRevision,
		ActionID:                wire.ActionID,
		ActionKind:              wire.ActionKind,
		RepositoryBindingDigest: wire.RepositoryBindingDigest,
		Payload:                 payload,
	}, nil
}

func decodeApplyActionWire(raw []byte) (applyActionWireInput, error) {
	if err := requireObjectMembers(raw, "request_id", "host", "task_id", "revision", "action_id", "action_kind", "repository_binding_digest", "payload"); err != nil {
		return applyActionWireInput{}, err
	}
	var wire applyActionWireInput
	if err := decodeClosed(raw, &wire); err != nil || !wire.RequestID.IsValid() || !wire.Host.IsValid() ||
		!wire.TaskID.IsValid() || wire.Revision == 0 || !wire.ActionID.IsValid() ||
		!wire.ActionKind.IsValid() || !wire.RepositoryBindingDigest.IsValid() || len(wire.Payload) == 0 {
		return applyActionWireInput{}, domain.ErrInvalidArgument
	}
	if len(wire.RecoveryApply) != 0 && !isJSONNull(wire.RecoveryApply) {
		if _, err := decodeRecoveryApply(wire.RecoveryApply); err != nil {
			return applyActionWireInput{}, err
		}
	}
	phase, err := inferredPayloadPhase(wire)
	if err != nil {
		return applyActionWireInput{}, err
	}
	if !isJSONNull(wire.Payload) {
		if _, err := decodeActionPayload(wire.Payload, phase, wire.ActionKind); err != nil {
			return applyActionWireInput{}, err
		}
	} else if len(wire.RecoveryApply) == 0 || isJSONNull(wire.RecoveryApply) {
		return applyActionWireInput{}, domain.ErrInvalidArgument
	}
	return wire, nil
}

func inferredPayloadPhase(wire applyActionWireInput) (domain.Phase, error) {
	if len(wire.RecoveryApply) != 0 && !isJSONNull(wire.RecoveryApply) {
		recoveryApply, err := decodeRecoveryApply(wire.RecoveryApply)
		if err != nil {
			return "", err
		}
		return recoveryApply.SourcePhase, nil
	}
	switch wire.ActionKind {
	case domain.ActionAssessTask:
		return domain.PhaseIntake, nil
	case domain.ActionPlanChange:
		return domain.PhaseAssess, nil
	case domain.ActionImplementChange:
		return domain.PhasePlan, nil
	case domain.ActionVerifyChange:
		return domain.PhaseImplement, nil
	case domain.ActionReviewChange:
		return domain.PhaseVerify, nil
	case domain.ActionResolveBlocker:
		return domain.PhaseBlocked, nil
	case domain.ActionPrepareHandoff:
		result, err := decodePayloadResult(wire.Payload)
		if err != nil {
			return "", err
		}
		if result == domain.ActionResultComplete {
			return domain.PhaseHandoff, nil
		}
		return domain.PhaseReview, nil
	default:
		return "", domain.ErrInvalidArgument
	}
}

func finishApplyActionInput(wire applyActionWireInput, sourcePhase domain.Phase) (application.ApplyActionRequest, error) {
	if !phaseAcceptsAction(sourcePhase, wire.ActionKind) {
		return application.ApplyActionRequest{}, domain.ErrInvalidArgument
	}
	var recoveryApply *application.RecoveryApplyInput
	if len(wire.RecoveryApply) != 0 && !isJSONNull(wire.RecoveryApply) {
		value, err := decodeRecoveryApply(wire.RecoveryApply)
		if err != nil || value.SourcePhase != sourcePhase {
			return application.ApplyActionRequest{}, domain.ErrInvalidArgument
		}
		recoveryApply = &value
	}
	var payload workflow.ActionPayload
	if !isJSONNull(wire.Payload) {
		value, err := decodeActionPayload(wire.Payload, sourcePhase, wire.ActionKind)
		if err != nil {
			return application.ApplyActionRequest{}, err
		}
		payload = value
	} else if recoveryApply == nil {
		return application.ApplyActionRequest{}, domain.ErrInvalidArgument
	}
	return application.ApplyActionRequest{
		RequestID:               wire.RequestID,
		Host:                    wire.Host,
		TaskID:                  wire.TaskID,
		ExpectedRevision:        wire.Revision,
		ActionID:                wire.ActionID,
		ActionKind:              wire.ActionKind,
		RepositoryBindingDigest: wire.RepositoryBindingDigest,
		Payload:                 payload,
		RecoveryApply:           recoveryApply,
	}, nil
}

func decodeRecoveryApply(raw []byte) (application.RecoveryApplyInput, error) {
	if err := requireObjectMembers(raw, "operation_id", "source_phase"); err != nil {
		return application.RecoveryApplyInput{}, err
	}
	var wire recoveryApplyWireInput
	if err := decodeClosed(raw, &wire); err != nil || !wire.OperationID.IsValid() ||
		(!wire.SourcePhase.NormalNonTerminal() && wire.SourcePhase != domain.PhaseBlocked) {
		return application.RecoveryApplyInput{}, domain.ErrInvalidArgument
	}
	return application.RecoveryApplyInput{OperationID: wire.OperationID, SourcePhase: wire.SourcePhase}, nil
}

func decodeCancelTaskInput(raw []byte, requestID domain.ID) (application.CancelTaskRequest, error) {
	if err := requireObjectMembers(raw, "host", "task_id", "revision", "reason"); err != nil {
		return application.CancelTaskRequest{}, err
	}
	var wire cancelTaskWireInput
	if err := decodeClosed(raw, &wire); err != nil || !requestID.IsValid() || !wire.Host.IsValid() ||
		!wire.TaskID.IsValid() || wire.Revision == 0 || !validRequiredBytes(wire.Reason, domain.MaxReasonBytes) {
		return application.CancelTaskRequest{}, domain.ErrInvalidArgument
	}
	return application.CancelTaskRequest{
		RequestID:        requestID,
		Host:             wire.Host,
		TaskID:           wire.TaskID,
		ExpectedRevision: wire.Revision,
		Reason:           wire.Reason,
	}, nil
}

func decodeActionPayload(raw []byte, phase domain.Phase, action domain.ActionKind) (workflow.ActionPayload, error) {
	if len(raw) == 0 || isJSONNull(raw) || len(raw) > domain.MaxActionPayloadBytes {
		return nil, domain.ErrInvalidArgument
	}
	var payload workflow.ActionPayload
	var err error
	switch phase {
	case domain.PhaseIntake:
		var value workflow.AssessTaskPayload
		err = decodeRequiredPayload(raw, &value, "result", "summary", "constraints", "risks", "intended_changed_surface", "verification_budget_acknowledged")
		payload = value
	case domain.PhaseAssess:
		var value workflow.PlanChangePayload
		err = decodeRequiredPayload(raw, &value, "result", "summary", "steps", "expected_changed_paths", "non_goals", "verification_steps", "unresolved_questions")
		payload = value
	case domain.PhasePlan:
		var value workflow.ImplementChangePayload
		err = decodeRequiredPayload(raw, &value, "result", "summary", "changed_paths", "no_file_changes", "deviations", "scope_confirmed")
		payload = value
	case domain.PhaseImplement:
		payload, err = decodeVerifyPayload(raw)
	case domain.PhaseVerify:
		var value workflow.ReviewChangePayload
		err = decodeRequiredPayload(raw, &value, "result", "summary", "findings", "residual_risks", "reason")
		payload = value
	case domain.PhaseReview:
		var value workflow.ReviewHandoffPayload
		value, err = decodeReviewHandoffPayload(raw)
		payload = value
	case domain.PhaseHandoff:
		var value workflow.CompleteHandoffPayload
		value, err = decodeCompleteHandoffPayload(raw)
		payload = value
	case domain.PhaseBlocked:
		var value workflow.ResolveBlockerPayload
		value, err = decodeResolveBlockerPayload(raw)
		payload = value
	default:
		return nil, domain.ErrInvalidArgument
	}
	if err != nil {
		return nil, domain.ErrInvalidArgument
	}
	if _, err := workflow.ValidatePayload(phase, action, payload); err != nil {
		return nil, domain.ErrInvalidArgument
	}
	return payload, nil
}

func decodeVerifyPayload(raw []byte) (workflow.ActionPayload, error) {
	if err := requireObjectMembers(raw, "result", "summary", "checks", "failed_items", "unverified_items", "manual_handoff_items", "reason"); err != nil {
		return nil, err
	}
	var wire verifyPayloadWire
	if err := decodeClosed(raw, &wire); err != nil {
		return nil, err
	}
	checks := make([]workflow.EvidenceInput, len(wire.Checks))
	for index, checkRaw := range wire.Checks {
		if err := requireObjectMembers(checkRaw, "source", "name", "status", "summary", "command_count", "full_suite"); err != nil {
			return nil, err
		}
		if err := decodeClosed(checkRaw, &checks[index]); err != nil {
			return nil, err
		}
	}
	return workflow.VerifyChangePayload{
		Result:             wire.Result,
		Summary:            wire.Summary,
		Checks:             checks,
		FailedItems:        wire.FailedItems,
		UnverifiedItems:    wire.UnverifiedItems,
		ManualHandoffItems: wire.ManualHandoffItems,
		Reason:             wire.Reason,
	}, nil
}

func decodeReviewHandoffPayload(raw []byte) (workflow.ReviewHandoffPayload, error) {
	wire, delivery, err := decodeHandoffPayload(raw)
	return workflow.ReviewHandoffPayload{Result: wire.Result, Summary: wire.Summary, Delivery: delivery, Reason: wire.Reason}, err
}

func decodeCompleteHandoffPayload(raw []byte) (workflow.CompleteHandoffPayload, error) {
	wire, delivery, err := decodeHandoffPayload(raw)
	return workflow.CompleteHandoffPayload{Result: wire.Result, Summary: wire.Summary, Delivery: delivery, Reason: wire.Reason}, err
}

func decodeHandoffPayload(raw []byte) (handoffPayloadWire, *workflow.DeliveryData, error) {
	if err := requireObjectMembers(raw, "result", "summary", "delivery", "reason"); err != nil {
		return handoffPayloadWire{}, nil, err
	}
	var wire handoffPayloadWire
	if err := decodeClosed(raw, &wire); err != nil {
		return handoffPayloadWire{}, nil, err
	}
	if isJSONNull(wire.Delivery) {
		return wire, nil, nil
	}
	delivery, err := decodeDelivery(wire.Delivery)
	if err != nil {
		return handoffPayloadWire{}, nil, err
	}
	return wire, &delivery, nil
}

func decodeDelivery(raw []byte) (workflow.DeliveryData, error) {
	if err := requireObjectMembers(raw, "acceptance", "automated_evidence_ids", "manual_evidence_ids", "unverified_items", "risks"); err != nil {
		return workflow.DeliveryData{}, err
	}
	var wire deliveryWire
	if err := decodeClosed(raw, &wire); err != nil {
		return workflow.DeliveryData{}, err
	}
	acceptance := make([]domain.OutcomeCriterion, len(wire.Acceptance))
	for index, criterionRaw := range wire.Acceptance {
		if err := requireObjectMembers(criterionRaw, "criterion", "status"); err != nil {
			return workflow.DeliveryData{}, err
		}
		if err := decodeClosed(criterionRaw, &acceptance[index]); err != nil {
			return workflow.DeliveryData{}, err
		}
	}
	return workflow.DeliveryData{
		Acceptance:           acceptance,
		AutomatedEvidenceIDs: wire.AutomatedEvidenceIDs,
		ManualEvidenceIDs:    wire.ManualEvidenceIDs,
		UnverifiedItems:      wire.UnverifiedItems,
		Risks:                wire.Risks,
	}, nil
}

func decodeResolveBlockerPayload(raw []byte) (workflow.ResolveBlockerPayload, error) {
	if err := requireObjectMembers(raw, "result", "blocker_id", "summary", "resolution_evidence"); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	var wire resolveBlockerPayloadWire
	if err := decodeClosed(raw, &wire); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	if err := requireObjectMembers(wire.ResolutionEvidence, "condition", "observed_binding_digest"); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	var evidence blockerResolutionWire
	if err := decodeClosed(wire.ResolutionEvidence, &evidence); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	if err := requireObjectMembers(evidence.Condition, "kind", "expected_binding_digest"); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	var condition domain.BlockerCondition
	if err := decodeClosed(evidence.Condition, &condition); err != nil {
		return workflow.ResolveBlockerPayload{}, err
	}
	return workflow.ResolveBlockerPayload{
		Result:    wire.Result,
		BlockerID: wire.BlockerID,
		Summary:   wire.Summary,
		ResolutionEvidence: workflow.BlockerResolutionEvidence{
			Condition:             condition,
			ObservedBindingDigest: evidence.ObservedBindingDigest,
		},
	}, nil
}

func decodePayloadResult(raw []byte) (domain.ActionResult, error) {
	if len(raw) == 0 || isJSONNull(raw) {
		return "", domain.ErrInvalidArgument
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return "", domain.ErrInvalidArgument
	}
	var result domain.ActionResult
	if err := json.Unmarshal(fields["result"], &result); err != nil || !result.IsValid() {
		return "", domain.ErrInvalidArgument
	}
	return result, nil
}

func decodeRequiredPayload(raw []byte, target any, required ...string) error {
	if err := requireObjectMembers(raw, required...); err != nil {
		return err
	}
	return decodeClosed(raw, target)
}

func requireObjectMembers(raw []byte, required ...string) error {
	if err := rejectDuplicateMembers(raw); err != nil {
		return domain.ErrInvalidArgument
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil || fields == nil {
		return domain.ErrInvalidArgument
	}
	if len(fields) < len(required) {
		return domain.ErrInvalidArgument
	}
	for _, name := range required {
		if _, present := fields[name]; !present {
			return domain.ErrInvalidArgument
		}
	}
	return nil
}

func decodeClosed(raw []byte, target any) error {
	if err := rejectDuplicateMembers(raw); err != nil {
		return domain.ErrInvalidArgument
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return domain.ErrInvalidArgument
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}

func rejectDuplicateMembers(raw []byte) error {
	if len(bytes.TrimSpace(raw)) == 0 || !utf8.Valid(raw) {
		return domain.ErrInvalidArgument
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := scanJSONValue(decoder); err != nil {
		return domain.ErrInvalidArgument
	}
	if _, err := decoder.Token(); err != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}

func scanJSONValue(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delimiter, compound := token.(json.Delim)
	if !compound {
		return nil
	}
	switch delimiter {
	case '{':
		seen := make(map[string]struct{})
		for decoder.More() {
			nameToken, err := decoder.Token()
			if err != nil {
				return err
			}
			name, ok := nameToken.(string)
			if !ok {
				return domain.ErrInvalidArgument
			}
			if _, duplicate := seen[name]; duplicate {
				return domain.ErrInvalidArgument
			}
			seen[name] = struct{}{}
			if err := scanJSONValue(decoder); err != nil {
				return err
			}
		}
		closing, err := decoder.Token()
		if err != nil || closing != json.Delim('}') {
			return domain.ErrInvalidArgument
		}
	case '[':
		for decoder.More() {
			if err := scanJSONValue(decoder); err != nil {
				return err
			}
		}
		closing, err := decoder.Token()
		if err != nil || closing != json.Delim(']') {
			return domain.ErrInvalidArgument
		}
	default:
		return domain.ErrInvalidArgument
	}
	return nil
}

func validRequiredBytes(value string, limit int) bool {
	return utf8.ValidString(value) && len(value) > 0 && len(value) <= limit && strings.TrimSpace(value) != ""
}

func isJSONNull(raw []byte) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func phaseAcceptsAction(phase domain.Phase, action domain.ActionKind) bool {
	expected, exists := workflow.ActionForPhase(phase)
	return exists && expected == action
}
