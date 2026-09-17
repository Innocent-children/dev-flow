package webui

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"net/http/httptest"
	"testing"
)

func TestExperienceMutationFailureRetainsUncertainRequest(t *testing.T) {
	for _, tc := range []struct {
		err   error
		state string
	}{{domain.ErrStorageUnavailable, "unknown"}, {domain.ErrRevisionConflict, "not_committed"}, {domain.ErrInvalidArgument, "not_committed"}} {
		w := httptest.NewRecorder()
		writeExperienceResponse(w, "request", nil, tc.err, true)
		var result FailureResponse
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.WorkflowWriteState != tc.state {
			t.Fatalf("failure=%s", w.Body.String())
		}
	}
}
