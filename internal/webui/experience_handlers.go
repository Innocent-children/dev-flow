package webui

import (
	"context"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"net/http"
	"strconv"
)

type ExperienceReader interface {
	GetExperiences(context.Context, domain.ID, domain.ID, int) (application.ExperienceDetail, error)
	SearchExperiences(context.Context, store.ExperienceQuery) (store.ExperiencePage, error)
}
type ExperienceMutator interface {
	ExportExperiences(context.Context, domain.ID) (store.ExperienceExport, error)
	AddExperienceNote(context.Context, store.ExperienceMutation) (domain.Experience, error)
}

func registerExperienceAPI(mux *http.ServeMux, reader ControlCenterReader, mutator ControlCenterMutator) {
	er, ok := reader.(ExperienceReader)
	if !ok {
		return
	}
	mux.HandleFunc("GET /api/experiences", func(w http.ResponseWriter, r *http.Request) {
		id := readRequestID()
		q := r.URL.Query()
		page := 0
		var err error
		if q.Get("page") != "" {
			page, err = strconv.Atoi(q.Get("page"))
		}
		if err != nil {
			writeReadError(w, id, domain.ErrInvalidArgument)
			return
		}
		result, err := er.SearchExperiences(r.Context(), store.ExperienceQuery{TaskID: domain.ID(q.Get("task_id")), Project: q.Get("project"), Text: q.Get("text"), Page: page})
		writeExperienceResponse(w, id, result, err, false)
	})
	mux.HandleFunc("GET /api/tasks/{task_id}/experiences", func(w http.ResponseWriter, r *http.Request) {
		id := readRequestID()
		page := 0
		var err error
		if r.URL.Query().Get("page") != "" {
			page, err = strconv.Atoi(r.URL.Query().Get("page"))
		}
		if err != nil {
			writeReadError(w, id, domain.ErrInvalidArgument)
			return
		}
		result, err := er.GetExperiences(r.Context(), domain.ID(r.PathValue("task_id")), domain.ID(r.URL.Query().Get("experience_id")), page)
		writeExperienceResponse(w, id, result, err, false)
	})
	em, ok := mutator.(ExperienceMutator)
	if !ok {
		return
	}
	mux.HandleFunc("POST /api/tasks/{task_id}/experiences/export", func(w http.ResponseWriter, r *http.Request) {
		id := readRequestID()
		var body struct {
			CSRF string `json:"csrf"`
		}
		if DecodeJSON(r, &body) != nil {
			writeMutationError(w, id, domain.ErrInvalidArgument)
			return
		}
		result, err := em.ExportExperiences(r.Context(), domain.ID(r.PathValue("task_id")))
		writeExperienceResponse(w, id, result, err, true)
	})
	mux.HandleFunc("POST /api/tasks/{task_id}/experiences/{experience_id}/notes", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			CSRF             string    `json:"csrf"`
			RequestID        domain.ID `json:"request_id"`
			ExpectedRevision uint64    `json:"expected_revision"`
			UserNote         string    `json:"user_note"`
		}
		id := readRequestID()
		if DecodeJSON(r, &body) != nil {
			writeMutationError(w, id, domain.ErrInvalidArgument)
			return
		}
		result, err := em.AddExperienceNote(r.Context(), store.ExperienceMutation{TaskID: domain.ID(r.PathValue("task_id")), ExperienceID: domain.ID(r.PathValue("experience_id")), RequestID: body.RequestID, ExpectedRevision: body.ExpectedRevision, UserNote: body.UserNote})
		writeExperienceResponse(w, id, result, err, true)
	})
}
func writeExperienceResponse(w http.ResponseWriter, id string, result any, err error, mutation bool) {
	if err != nil {
		if !mutation {
			writeReadError(w, id, err)
			return
		}
		code, message := domain.ErrorInternal, domain.ErrInternal.Message
		var typed *domain.Error
		if errors.As(err, &typed) {
			code, message = typed.Code, typed.Message
		}
		state, status := "not_committed", http.StatusConflict
		if code == domain.ErrorInternal || code == domain.ErrorStorageUnavailable {
			state, status = "unknown", http.StatusInternalServerError
		}
		if code == domain.ErrorInvalidArgument {
			status = http.StatusBadRequest
		}
		if code == domain.ErrorTaskNotFound {
			status = http.StatusNotFound
		}
		if code == domain.ErrorRevisionConflict {
			message = "The experience revision changed; reload the experience before editing."
		}
		failure := ErrorResponse{Code: string(code), Message: message, FieldPaths: domain.ViolationPaths(err)}
		if typed != nil {
			failure.Details = typed.Violations
			failure.Budget = typed.Budget
		}
		_ = WriteFailure(w, status, id, state, failure, RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Read current experiences. After an uncertain save, retain and repeat the identical note request ID and content."})
		return
	}
	_ = WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "request_id": id, "result": result})
}
