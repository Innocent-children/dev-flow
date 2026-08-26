package webui

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

type lifecycleHandlers struct{ mutator ControlCenterMutator }

func (h *lifecycleHandlers) openTask(w http.ResponseWriter, r *http.Request) {
	var request OpenTaskRequest
	if DecodeJSON(r, &request) != nil {
		writeMutationError(w, "request-invalid", domain.ErrInvalidArgument)
		return
	}
	budget, err := decodeVerificationBudget(request.VerificationBudget)
	if err != nil || request.Mode != "create" && request.Mode != "resume" {
		writeMutationError(w, request.RequestID, domain.ErrInvalidArgument)
		return
	}
	input := application.OpenTaskRequest{RequestID: domain.ID(request.RequestID), Host: domain.Host(request.ExecutionHost), RepositoryPath: request.PrimaryRepository.Path}
	if request.Mode == "create" {
		input.PrimaryRepositoryKey = domain.RepositoryKey(request.PrimaryRepository.Key)
		input.AdditionalRepositories = make([]application.AdditionalRepositoryInput, len(request.AdditionalRepositories))
		for index, repository := range request.AdditionalRepositories {
			input.AdditionalRepositories[index] = application.AdditionalRepositoryInput{Key: domain.RepositoryKey(repository.Key), RepositoryPath: repository.Path}
		}
		input.NewTask = &application.NewTaskInput{Request: request.Request, KnownAcceptanceCriteria: append([]string{}, request.AcceptanceCriteria...), VerificationBudget: budget, MethodProfile: domain.MethodProfile(request.MethodProfile)}
	}
	result, err := h.mutator.OpenOrResumeTask(r.Context(), input)
	if err != nil {
		writeMutationError(w, request.RequestID, err)
		return
	}
	writeTaskMutation(w, request.RequestID, result)
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

func decodeVerificationBudget(raw string) (domain.VerificationBudget, error) {
	decoder := json.NewDecoder(bytes.NewBufferString(raw))
	decoder.DisallowUnknownFields()
	var budget domain.VerificationBudget
	if err := decoder.Decode(&budget); err != nil || budget.Validate() != nil {
		return domain.VerificationBudget{}, domain.ErrInvalidArgument
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return domain.VerificationBudget{}, domain.ErrInvalidArgument
	}
	return budget, nil
}
