package webui

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

var ErrSessionUnavailable = errors.New("webui session unavailable")

type Session struct {
	value string
}

func NewSession() (Session, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return Session{}, ErrSessionUnavailable
	}
	return Session{value: base64.RawURLEncoding.EncodeToString(raw[:])}, nil
}

func (s Session) Value() string {
	return s.value
}

func (s Session) Matches(value string) bool {
	if s.value == "" || len(value) != len(s.value) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(value), []byte(s.value)) == 1
}

func mutationRequest(r *http.Request) bool {
	switch r.Method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func protectMutations(origin string, session Session, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !mutationRequest(r) {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, maxRequestBodyBytes+1))
		if err != nil || len(body) > maxRequestBodyBytes {
			rejectLocalMutation(w)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		var protection struct {
			CSRF string `json:"csrf"`
		}
		if r.Header.Get("Origin") != origin || json.Unmarshal(body, &protection) != nil || !session.Matches(protection.CSRF) {
			rejectLocalMutation(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func rejectLocalMutation(w http.ResponseWriter) {
	_ = WriteFailure(w, http.StatusForbidden, "request-rejected", "not_committed", ErrorResponse{
		Code:       "LOCAL_SESSION_REQUIRED",
		Message:    "The mutation must originate from the current local WebUI session.",
		FieldPaths: []string{},
		GuardID:    nil,
	}, RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Reload the local WebUI and retry from the current page."})
}
