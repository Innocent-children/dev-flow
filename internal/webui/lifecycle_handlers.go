package webui

import (
	"errors"
	"net/http"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

type lifecycleHandlers struct{ mutator ControlCenterMutator }

func (h *lifecycleHandlers) resumeTask(w http.ResponseWriter, r *http.Request) {
	var request ResumeTaskRequest
	if DecodeJSON(r, &request) != nil {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	if request.RequestID == "" || request.RepositoryPath == "" {
		writeMutationError(w, request.RequestID, domain.ErrInvalidArgument)
		return
	}
	result, err := h.mutator.OpenOrResumeTask(r.Context(), application.OpenTaskRequest{
		RequestID: domain.ID(request.RequestID), Host: domain.Host(request.ExecutionHost),
		RepositoryPath: request.RepositoryPath, NewTask: nil,
	})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	writeTaskMutation(w, request.RequestID, result)
}

func (h *lifecycleHandlers) prepareRelocation(w http.ResponseWriter, r *http.Request) {
	var request PrepareRelocationRequest
	if DecodeJSON(r, &request) != nil || !request.Confirmed {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	result, err := h.mutator.PrepareTaskRelocation(r.Context(), application.PrepareTaskRelocationRequest{
		RequestID: domain.ID(request.RequestID), Host: domain.Host(request.ExecutionHost), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision,
	})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	revision := result.Task.Revision
	redirect := "/tasks/" + string(result.Task.TaskID)
	relocationID := string(result.RelocationID)
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: request.RequestID, WorkflowWriteState: "committed", TaskRevision: &revision, Redirect: &redirect, RelocationID: &relocationID})
}

func (h *lifecycleHandlers) abandonTask(w http.ResponseWriter, r *http.Request) {
	var request AbandonMutationRequest
	if DecodeJSON(r, &request) != nil || !request.Confirmed {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	result, err := h.mutator.AbandonTask(r.Context(), application.AbandonTaskRequest{
		RequestID: domain.ID(request.RequestID), Host: domain.Host(request.ExecutionHost), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision, Reason: request.Reason,
	})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	revision := result.Task.Revision
	redirect := "/tasks/" + string(result.Task.TaskID)
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: request.RequestID, WorkflowWriteState: "committed", TaskRevision: &revision, Redirect: &redirect})
}

func (h *lifecycleHandlers) cancelTask(w http.ResponseWriter, r *http.Request) {
	var request ReasonedMutationRequest
	if DecodeJSON(r, &request) != nil {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	result, err := h.mutator.CancelLifecycleTask(r.Context(), application.CancelControlCenterTaskRequest{RequestID: domain.ID(request.RequestID), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision, Reason: request.Reason, Confirmed: request.Confirmed})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	writeTaskMutation(w, request.RequestID, result)
}

func (h *lifecycleHandlers) archiveTask(w http.ResponseWriter, r *http.Request) {
	var request ArchiveMutationRequest
	if DecodeJSON(r, &request) != nil {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	_, err := h.mutator.SetTaskArchive(r.Context(), application.SetTaskArchiveRequest{RequestID: domain.ID(request.RequestID), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision, Archived: request.Archived})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	revision := request.TaskRevision
	redirect := "/tasks/" + r.PathValue("task_id")
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: request.RequestID, WorkflowWriteState: "not_committed", TaskRevision: &revision, Redirect: &redirect})
}

func (h *lifecycleHandlers) purgeTask(w http.ResponseWriter, r *http.Request) {
	var request PurgeMutationRequest
	if DecodeJSON(r, &request) != nil {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	_, err := h.mutator.PurgeLifecycleTask(r.Context(), application.PurgeControlCenterTaskRequest{RequestID: domain.ID(request.RequestID), TaskID: domain.ID(r.PathValue("task_id")), ExpectedRevision: request.TaskRevision, TypedTaskID: domain.ID(request.TypedTaskID), Reason: request.Reason, Irreversible: request.Irreversible})
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	redirect := "/tasks"
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: request.RequestID, WorkflowWriteState: "committed", Redirect: &redirect})
}

func writeTaskMutation(w http.ResponseWriter, requestID string, result application.ControlCenterMutationResult) {
	if result.Task == nil {
		writeMutationError(w, requestID, domain.ErrInternal)
		return
	}
	revision := result.Task.Revision
	redirect := "/tasks/" + string(result.Task.TaskID)
	_ = WriteJSON(w, http.StatusOK, MutationResponse{OK: true, RequestID: requestID, WorkflowWriteState: "committed", TaskRevision: &revision, Redirect: &redirect})
}

func writeMutationError(w http.ResponseWriter, requestID string, err error) {
	status := http.StatusConflict
	code, message := domain.ErrorInternal, domain.ErrInternal.Message
	var typed *domain.Error
	if errors.As(err, &typed) {
		code, message = typed.Code, typed.Message
		switch typed.Code {
		case domain.ErrorInvalidArgument:
			status = http.StatusBadRequest
		case domain.ErrorTaskNotFound:
			status = http.StatusNotFound
		case domain.ErrorInternal, domain.ErrorStorageUnavailable:
			status = http.StatusInternalServerError
		}
	}
	recovery := RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Reload the current Task and review the requested lifecycle operation."}
	if code == domain.ErrorRevisionConflict {
		recovery = RecoveryAdvice{Action: RecoveryReadNextAction, RetrySafe: false, Message: "Reload the current Task before submitting another lifecycle operation."}
	}
	_ = WriteFailure(w, status, requestID, "not_committed", ErrorResponse{Code: string(code), Message: message, FieldPaths: domain.ViolationPaths(err)}, recovery)
}
