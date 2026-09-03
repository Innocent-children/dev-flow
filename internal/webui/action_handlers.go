package webui

import (
	"errors"
	"net/http"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type actionHandlers struct{ mutator ControlCenterMutator }

func (h *actionHandlers) submit(w http.ResponseWriter, r *http.Request) {
	var request ActionSubmissionRequest
	if DecodeJSON(r, &request) != nil {
		writeActionError(w, "request-invalid", domain.ErrInvalidArgument, true)
		return
	}
	result, err := h.mutator.SubmitCurrentAction(r.Context(), application.SubmitControlCenterActionRequest{
		RequestID: domain.ID(request.RequestID), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision,
		ActionID: domain.ID(request.ActionID), ActionKind: domain.ActionKind(request.ActionKind), ProcessID: domain.ProcessID(request.ProcessID),
		ProcessDefinitionDigest: domain.Digest(request.ProcessDefinitionDigest), SourceNode: domain.NodeID(request.SourceNode),
		RepositoryBindingDigest: domain.Digest(request.RepositoryBindingDigest), IssuanceIdentityDigest: domain.Digest(request.IssuanceIdentityDigest),
		IssuanceHistoryDigest: domain.Digest(request.IssuanceHistoryDigest), IssuanceContentDigest: domain.Digest(request.IssuanceContentDigest),
		Payload: append([]byte(nil), request.Payload...),
	})
	if err != nil {
		writeActionError(w, request.RequestID, err, false)
		return
	}
	writeActionResult(w, request.RequestID, result)
}

func (h *actionHandlers) assessRecovery(w http.ResponseWriter, r *http.Request) {
	var request RecoveryAssessmentRequest
	if DecodeJSON(r, &request) != nil {
		writeActionError(w, "request-invalid", domain.ErrInvalidArgument, true)
		return
	}
	result, err := h.mutator.AssessTaskOperation(r.Context(), application.AssessControlCenterRecoveryRequest{TaskID: domain.ID(r.PathValue("task_id")), Operation: projectOperationProbe(request.Operation)})
	if err != nil {
		writeActionError(w, request.Operation.OperationID, err, true)
		return
	}
	writeActionResult(w, request.Operation.OperationID, result)
}

func (h *actionHandlers) applyRecovery(w http.ResponseWriter, r *http.Request) {
	var request RecoverySubmissionRequest
	if DecodeJSON(r, &request) != nil {
		writeActionError(w, "request-invalid", domain.ErrInvalidArgument, true)
		return
	}
	result, err := h.mutator.ApplyTaskRecovery(r.Context(), application.ApplyControlCenterRecoveryRequest{
		TaskID: domain.ID(r.PathValue("task_id")), Operation: projectOperationProbe(request.Operation), RecoveryAction: recovery.RecoveryAdvice(request.RecoveryAction),
	})
	if err != nil {
		writeActionError(w, request.Operation.OperationID, err, false)
		return
	}
	writeActionResult(w, request.Operation.OperationID, result)
}

func projectOperationProbe(probe OperationProbe) application.OperationProbe {
	return application.OperationProbe{
		OperationID: domain.ID(probe.OperationID), ExpectedRevision: probe.ExpectedRevision, ActionID: domain.ID(probe.ActionID),
		ActionKind: domain.ActionKind(probe.ActionKind), ProcessID: domain.ProcessID(probe.ProcessID), ProcessDefinitionDigest: domain.Digest(probe.ProcessDefinitionDigest),
		SourceCursor: domain.NodeID(probe.SourceNode), RepositoryBindingDigest: domain.Digest(probe.RepositoryBindingDigest),
		IssuanceIdentityDigest: domain.Digest(probe.IssuanceIdentityDigest), IssuanceHistoryDigest: domain.Digest(probe.IssuanceHistoryDigest), IssuanceContentDigest: domain.Digest(probe.IssuanceContentDigest),
		Payload: append([]byte(nil), probe.Payload...),
	}
}

func writeActionResult(w http.ResponseWriter, requestID string, result application.ControlCenterActionResult) {
	revision := result.Task.Revision
	redirect := "/tasks/" + string(result.Task.TaskID)
	writeState := "not_committed"
	if result.Committed {
		writeState = "committed"
	}
	var advice *RecoveryAdvice
	if result.Assessment != nil {
		mapped := projectRecoveryAdvice(result.Assessment.NextAdvice, result.Assessment.ActionRetrySafe)
		advice = &mapped
	}
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: requestID, WorkflowWriteState: writeState, TaskRevision: &revision, Redirect: &redirect, Recovery: advice})
}

func projectRecoveryAdvice(action recovery.RecoveryAdvice, retrySafe bool) RecoveryAdvice {
	messages := map[recovery.RecoveryAdvice]string{
		recovery.AdviceRetryCurrentAction:     "Core found no completed mutation. Retry the retained current Action.",
		recovery.AdviceSubmitRecoveryApply:    "Core found operation evidence that must be reconciled through Recovery apply.",
		recovery.AdviceReadNextAction:         "Read the authoritative current Task and its next Action.",
		recovery.AdviceResolveBlocker:         "Read and complete the current blocker-resolution Action.",
		recovery.AdviceStopForRepositoryDrift: "Stop and restore the repository state required by Core.",
	}
	return RecoveryAdvice{Action: RecoveryAction(action), RetrySafe: retrySafe, Message: messages[action]}
}

func writeActionError(w http.ResponseWriter, requestID string, err error, boundaryZeroWrite bool) {
	status := http.StatusConflict
	code, message := domain.ErrorInternal, domain.ErrInternal.Message
	writeState := "unknown"
	var typed *domain.Error
	if errors.As(err, &typed) && typed.Code.IsValid() {
		code, message = typed.Code, typed.Message
		if typed.ZeroWrite || boundaryZeroWrite {
			writeState = "not_committed"
		}
		switch typed.Code {
		case domain.ErrorInvalidArgument:
			status = http.StatusBadRequest
		case domain.ErrorTaskNotFound:
			status = http.StatusNotFound
		case domain.ErrorInternal, domain.ErrorStorageUnavailable:
			status = http.StatusInternalServerError
		}
	}
	paths := domain.ViolationPaths(err)
	var guardID *string
	if typed != nil && typed.Guard != nil && workflow.KnownTransitionGuard(typed.Guard.GuardID) {
		value := string(typed.Guard.GuardID)
		guardID = &value
	}
	advice := RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Assess the retained operation before another write."}
	if writeState == "not_committed" && actionCorrectionSafe(typed) {
		advice = RecoveryAdvice{Action: RecoveryCorrectCurrentAction, RetrySafe: true, Message: "Correct only the listed fields while this Action identity remains current."}
	} else if code == domain.ErrorRevisionConflict || code == domain.ErrorActionStale {
		advice = RecoveryAdvice{Action: RecoveryReadNextAction, RetrySafe: false, Message: "Read the authoritative current Task before another mutation."}
	}
	_ = WriteFailure(w, status, requestID, writeState, ErrorResponse{Code: string(code), Message: message, FieldPaths: paths, GuardID: guardID}, advice)
}

func actionCorrectionSafe(failure *domain.Error) bool {
	if failure == nil || !failure.ZeroWrite || failure.Code != domain.ErrorInvalidArgument && failure.Code != domain.ErrorTransitionNotAllowed {
		return false
	}
	entries := append([]domain.ContractViolation(nil), failure.Violations...)
	if failure.Guard != nil {
		entries = append(entries, failure.Guard.Failures...)
	}
	if len(entries) == 0 {
		return false
	}
	for _, entry := range entries {
		switch entry.Rule {
		case domain.RuleNonAutomatedCommandCountZero, domain.RuleNonAutomatedFullSuiteFalse, domain.RuleUnknownMember:
		default:
			if domain.GuardRule(entry.Rule) != domain.GuardForwardFindingsEmpty {
				return false
			}
		}
	}
	return true
}
