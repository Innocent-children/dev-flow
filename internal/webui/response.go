package webui

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const maxRequestBodyBytes = 1 << 20

var ErrInvalidJSON = errors.New("invalid JSON request")

func WriteJSON(w http.ResponseWriter, status int, value any) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(value)
}

func DecodeJSON(r *http.Request, value any) error {
	if r == nil || r.Body == nil || value == nil {
		return ErrInvalidJSON
	}
	decoder := json.NewDecoder(io.LimitReader(r.Body, maxRequestBodyBytes+1))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return ErrInvalidJSON
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return ErrInvalidJSON
	}
	return nil
}

func WriteFailure(w http.ResponseWriter, status int, requestID, writeState string, failure ErrorResponse, recovery RecoveryAdvice) error {
	return WriteJSON(w, status, FailureResponse{
		OK:                 false,
		RequestID:          requestID,
		WorkflowWriteState: writeState,
		Error:              failure,
		Recovery:           recovery,
	})
}
