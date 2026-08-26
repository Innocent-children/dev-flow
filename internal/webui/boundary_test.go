package webui

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestWebBoundaryCP1(t *testing.T) {
	reader := &stubControlCenterReader{}
	api, err := NewReadAPI(reader, func() SystemStatusResponse {
		return SystemStatusResponse{Readiness: ReadinessReady, CoreIdentity: "dev-flow-test", DataRootDigest: strings.Repeat("a", 64), URL: "http://127.0.0.1:1"}
	})
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(api)
	if err != nil {
		t.Fatal(err)
	}
	serveDone := make(chan error, 1)
	go func() { serveDone <- server.Serve() }()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Close(ctx); err != nil {
			t.Error(err)
		}
		<-serveDone
	})

	t.Run("loopback read routes and revision refresh", func(t *testing.T) {
		first := getTaskRevision(t, server.URL()+"/api/tasks/task")
		second := getTaskRevision(t, server.URL()+"/api/tasks/task")
		if first != 1 || second != 2 {
			t.Fatalf("revisions=%d,%d want 1,2", first, second)
		}
	})

	t.Run("exact Host is required", func(t *testing.T) {
		request, _ := http.NewRequest(http.MethodGet, server.URL()+"/api/dashboard", nil)
		request.Host = "localhost:1"
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusForbidden {
			t.Fatalf("status=%d", response.StatusCode)
		}
	})

	t.Run("session and exact Origin protect mutations", func(t *testing.T) {
		body := []byte(`{"csrf":"wrong"}`)
		request, _ := http.NewRequest(http.MethodPost, server.URL()+"/api/tasks/task/cancel", bytes.NewReader(body))
		request.Header.Set("Origin", server.URL())
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusForbidden {
			t.Fatalf("status=%d", response.StatusCode)
		}
	})

	t.Run("unknown query and reset route stay closed", func(t *testing.T) {
		response, err := http.Get(server.URL() + "/api/tasks?unknown=value")
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusBadRequest {
			t.Fatalf("unknown query status=%d", response.StatusCode)
		}
		reset, err := http.Get(server.URL() + "/api/system/reset")
		if err != nil {
			t.Fatal(err)
		}
		reset.Body.Close()
		if reset.StatusCode != http.StatusNotFound {
			t.Fatalf("reset status=%d", reset.StatusCode)
		}
		body := []byte(`{"csrf":"` + server.session.Value() + `"}`)
		request, _ := http.NewRequest(http.MethodPost, server.URL()+"/api/system/reset", bytes.NewReader(body))
		request.Header.Set("Origin", server.URL())
		request.Header.Set("Content-Type", "application/json")
		mutation, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		mutation.Body.Close()
		if mutation.StatusCode != http.StatusNotFound {
			t.Fatalf("reset mutation status=%d", mutation.StatusCode)
		}
	})
}

type stubControlCenterReader struct {
	mu       sync.Mutex
	revision uint64
}

func (s *stubControlCenterReader) Dashboard(context.Context) (application.ControlCenterDashboard, error) {
	return application.ControlCenterDashboard{Counts: map[string]int{"active": 1}, Recent: []application.ControlCenterTaskSummary{}}, nil
}

func (s *stubControlCenterReader) ListTasks(context.Context, application.ListControlCenterTasksRequest) (application.ControlCenterTaskList, error) {
	return application.ControlCenterTaskList{Page: 1, Items: []application.ControlCenterTaskSummary{}}, nil
}

func (s *stubControlCenterReader) GetTaskDetail(context.Context, application.GetControlCenterTaskRequest) (application.ControlCenterTaskDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revision++
	now := time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	return application.ControlCenterTaskDetail{Task: domain.ProcessTask{TaskID: "task", OriginHost: domain.HostCodex, Intent: domain.TaskIntent{Request: "Read a task", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted}, MethodProfile: domain.MethodPlain}, Process: domain.ProcessReference{ID: domain.ProcessStandardDevelopment, DefinitionDigest: digest}, CurrentNode: domain.NodeRequirements, PrimaryRepositoryKey: domain.DefaultPrimaryRepositoryKey, Repository: domain.RepositoryBinding{CanonicalRoot: "/repo"}, Revision: s.revision, CreatedAt: now, UpdatedAt: now}, ReadOnly: true}, nil
}

func getTaskRevision(t *testing.T, target string) uint64 {
	t.Helper()
	response, err := http.Get(target)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.StatusCode, raw)
	}
	var body TaskDetailResponse
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	return body.Summary.Revision
}
