package webui

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
)

type ControlCenterReader interface {
	Dashboard(context.Context) (application.ControlCenterDashboard, error)
	ListTasks(context.Context, application.ListControlCenterTasksRequest) (application.ControlCenterTaskList, error)
	GetTaskDetail(context.Context, application.GetControlCenterTaskRequest) (application.ControlCenterTaskDetail, error)
}

type SystemStatusProvider func() SystemStatusResponse

type ControlCenterMutator interface {
	OpenOrResumeTask(context.Context, application.OpenTaskRequest) (application.ControlCenterMutationResult, error)
	CancelLifecycleTask(context.Context, application.CancelControlCenterTaskRequest) (application.ControlCenterMutationResult, error)
	SetTaskArchive(context.Context, application.SetTaskArchiveRequest) (application.ControlCenterMutationResult, error)
	PurgeLifecycleTask(context.Context, application.PurgeControlCenterTaskRequest) (application.ControlCenterMutationResult, error)
	SubmitCurrentAction(context.Context, application.SubmitControlCenterActionRequest) (application.ControlCenterActionResult, error)
	AssessTaskOperation(context.Context, application.AssessControlCenterRecoveryRequest) (application.ControlCenterActionResult, error)
	ApplyTaskRecovery(context.Context, application.ApplyControlCenterRecoveryRequest) (application.ControlCenterActionResult, error)
}

func NewReadAPI(reader ControlCenterReader, status SystemStatusProvider) (http.Handler, error) {
	return newAPI(reader, nil, status)
}

func NewAPI(reader ControlCenterReader, mutator ControlCenterMutator, status SystemStatusProvider) (http.Handler, error) {
	if mutator == nil {
		return nil, ErrSessionUnavailable
	}
	return newAPI(reader, mutator, status)
}

func newAPI(reader ControlCenterReader, mutator ControlCenterMutator, status SystemStatusProvider) (http.Handler, error) {
	if reader == nil || status == nil {
		return nil, ErrSessionUnavailable
	}
	handlers := &readHandlers{reader: reader, status: status}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/dashboard", handlers.dashboard)
	mux.HandleFunc("GET /api/tasks", handlers.taskList)
	mux.HandleFunc("GET /api/tasks/{task_id}", handlers.taskDetail)
	mux.HandleFunc("GET /api/system/status", handlers.systemStatus)
	mux.HandleFunc("GET /api/system/filter-options", handlers.filterOptions)
	if mutator != nil {
		lifecycle := &lifecycleHandlers{mutator: mutator}
		mux.HandleFunc("POST /api/tasks/open", lifecycle.openTask)
		mux.HandleFunc("POST /api/tasks/{task_id}/cancel", lifecycle.cancelTask)
		mux.HandleFunc("POST /api/tasks/{task_id}/archive", lifecycle.archiveTask)
		mux.HandleFunc("POST /api/tasks/{task_id}/purge", lifecycle.purgeTask)
		actions := &actionHandlers{mutator: mutator}
		mux.HandleFunc("POST /api/tasks/{task_id}/actions/submit", actions.submit)
		mux.HandleFunc("POST /api/tasks/{task_id}/recovery/assess", actions.assessRecovery)
		mux.HandleFunc("POST /api/tasks/{task_id}/recovery/apply", actions.applyRecovery)
	}
	return mux, nil
}

type Server struct {
	listener net.Listener
	server   *http.Server
	origin   string
	session  Session
}

func NewServer(api http.Handler) (*Server, error) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	session, err := NewSession()
	if err != nil {
		_ = listener.Close()
		return nil, err
	}
	static, err := newStaticHandler(session.Value())
	if err != nil {
		_ = listener.Close()
		return nil, err
	}
	if api == nil {
		api = http.HandlerFunc(apiNotFound)
	}
	address := listener.Addr().String()
	origin := "http://" + address
	mux := http.NewServeMux()
	mux.Handle("/api/", protectMutations(origin, session, api))
	mux.Handle("/", static)
	handler := exactHost(address, mux)
	return &Server{
		listener: listener,
		server: &http.Server{
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
		},
		origin:  origin,
		session: session,
	}, nil
}

func (s *Server) URL() string {
	if s == nil {
		return ""
	}
	return s.origin
}

func (s *Server) Serve() error {
	if s == nil || s.listener == nil || s.server == nil {
		return ErrSessionUnavailable
	}
	err := s.server.Serve(s.listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Close(ctx context.Context) error {
	if s == nil || s.server == nil || ctx == nil {
		return ErrSessionUnavailable
	}
	return s.server.Shutdown(ctx)
}

func exactHost(expected string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != expected {
			_ = WriteFailure(w, http.StatusForbidden, "request-rejected", "not_committed", ErrorResponse{
				Code:       "LOOPBACK_HOST_REQUIRED",
				Message:    "The request must use the exact local WebUI host.",
				FieldPaths: []string{},
				GuardID:    nil,
			}, RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Open the URL reported by the current local WebUI process."})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func apiNotFound(w http.ResponseWriter, _ *http.Request) {
	_ = WriteFailure(w, http.StatusNotFound, "request-not-found", "not_committed", ErrorResponse{
		Code:       "ROUTE_NOT_FOUND",
		Message:    "The requested WebUI API route is not available.",
		FieldPaths: []string{},
		GuardID:    nil,
	}, RecoveryAdvice{Action: RecoveryNone, RetrySafe: false, Message: "Use a route exposed by the current Core."})
}
