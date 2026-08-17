package mcp

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

var errBoundedResponseWrite = errors.New("bounded response writer rejected the remaining bytes")

type boundedFailingResponseWriter struct {
	limit  int
	buffer bytes.Buffer
}

func (writer *boundedFailingResponseWriter) Write(data []byte) (int, error) {
	remaining := writer.limit - writer.buffer.Len()
	if remaining <= 0 {
		return 0, errBoundedResponseWrite
	}
	if remaining > len(data) {
		remaining = len(data)
	}
	written, _ := writer.buffer.Write(data[:remaining])
	if written < len(data) || writer.buffer.Len() == writer.limit {
		return written, errBoundedResponseWrite
	}
	return written, nil
}

func (writer *boundedFailingResponseWriter) Bytes() []byte {
	return bytes.Clone(writer.buffer.Bytes())
}

type uncertainMCPFixture struct {
	ctx          context.Context
	databasePath string
	taskStore    *store.SQLite
	service      *application.Service
	server       *Server
	source       domain.Task
	payload      workflow.AssessTaskPayload
	request      application.ApplyActionRequest
	applyRaw     json.RawMessage
	readRaw      json.RawMessage
}

func newUncertainMCPFixture(t *testing.T, operationID domain.ID) uncertainMCPFixture {
	t.Helper()
	ctx := context.Background()
	repositoryPath := newMCPRecoveryRepository(t)
	databasePath := filepath.Join(t.TempDir(), "uncertain-mcp.db")
	taskStore, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open uncertain MCP store: %v", err)
	}
	t.Cleanup(func() { _ = taskStore.Close() })
	service, err := application.NewService(taskStore, repository.NewGitObserver())
	if err != nil {
		t.Fatalf("construct uncertain MCP service: %v", err)
	}
	server, err := NewServer(service, "0.1.0", nil)
	if err != nil {
		t.Fatalf("construct uncertain MCP server: %v", err)
	}
	opened, err := service.OpenTask(ctx, application.OpenTaskRequest{
		RequestID:      "request-uncertain-mcp-open",
		Host:           domain.HostCodex,
		RepositoryPath: repositoryPath,
		NewTask: &application.NewTaskInput{
			Goal:               "prove uncertain MCP result read-back",
			Scope:              []string{"pre-serialization and partial response boundaries"},
			OutOfScope:         []string{"production failpoints"},
			AcceptanceCriteria: []string{"an exact read proves the committed operation"},
			VerificationBudget: domain.VerificationBudget{
				Level:                domain.VerificationTargeted,
				MaxAutomaticCommands: 2,
			},
		},
	})
	if err != nil {
		t.Fatalf("open uncertain MCP task: %v", err)
	}
	source := opened.Task
	if source.CurrentAction == nil {
		t.Fatal("uncertain MCP source has no current action")
	}
	payload := workflow.AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "uncertain MCP assessment committed",
		VerificationBudgetAcknowledged: true,
	}
	request := application.ApplyActionRequest{
		RequestID:               operationID,
		Host:                    source.OriginHost,
		TaskID:                  source.TaskID,
		ExpectedRevision:        source.Revision,
		ActionID:                source.CurrentAction.ActionID,
		ActionKind:              source.CurrentAction.Kind,
		RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload,
	}
	applyRaw := marshalMCPRecoveryJSON(t, struct {
		RequestID               domain.ID                  `json:"request_id"`
		Host                    domain.Host                `json:"host"`
		TaskID                  domain.ID                  `json:"task_id"`
		Revision                uint64                     `json:"revision"`
		ActionID                domain.ID                  `json:"action_id"`
		ActionKind              domain.ActionKind          `json:"action_kind"`
		RepositoryBindingDigest domain.Digest              `json:"repository_binding_digest"`
		Payload                 workflow.AssessTaskPayload `json:"payload"`
		RecoveryApply           any                        `json:"recovery_apply"`
	}{
		RequestID: operationID, Host: source.OriginHost, TaskID: source.TaskID,
		Revision: source.Revision, ActionID: source.CurrentAction.ActionID,
		ActionKind:              source.CurrentAction.Kind,
		RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest,
		Payload:                 payload, RecoveryApply: nil,
	})
	readRaw := marshalMCPRecoveryJSON(t, struct {
		Host           domain.Host `json:"host"`
		TaskID         domain.ID   `json:"task_id"`
		OperationProbe struct {
			OperationID             domain.ID                  `json:"operation_id"`
			SourcePhase             domain.Phase               `json:"source_phase"`
			ExpectedRevision        uint64                     `json:"expected_revision"`
			ActionID                domain.ID                  `json:"action_id"`
			ActionKind              domain.ActionKind          `json:"action_kind"`
			RepositoryBindingDigest domain.Digest              `json:"repository_binding_digest"`
			Payload                 workflow.AssessTaskPayload `json:"payload"`
		} `json:"operation_probe"`
	}{
		Host: source.OriginHost, TaskID: source.TaskID,
		OperationProbe: struct {
			OperationID             domain.ID                  `json:"operation_id"`
			SourcePhase             domain.Phase               `json:"source_phase"`
			ExpectedRevision        uint64                     `json:"expected_revision"`
			ActionID                domain.ID                  `json:"action_id"`
			ActionKind              domain.ActionKind          `json:"action_kind"`
			RepositoryBindingDigest domain.Digest              `json:"repository_binding_digest"`
			Payload                 workflow.AssessTaskPayload `json:"payload"`
		}{
			OperationID: operationID, SourcePhase: source.Phase, ExpectedRevision: source.Revision,
			ActionID: source.CurrentAction.ActionID, ActionKind: source.CurrentAction.Kind,
			RepositoryBindingDigest: source.CurrentAction.RepositoryBindingDigest, Payload: payload,
		},
	})
	return uncertainMCPFixture{
		ctx: ctx, databasePath: databasePath, taskStore: taskStore, service: service,
		server: server, source: source, payload: payload, request: request, applyRaw: applyRaw, readRaw: readRaw,
	}
}

func marshalMCPRecoveryJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("encode uncertain MCP fixture: %v", err)
	}
	return encoded
}

func requireMCPCommittedReadBack(t *testing.T, fixture uncertainMCPFixture) GetTaskToolResult {
	t.Helper()
	encoded := fixture.server.dispatch(
		fixture.ctx,
		ToolGetTask,
		"request-authoritative-read-back",
		fixture.readRaw,
	)
	if encoded.IsError {
		t.Fatalf("authoritative MCP read-back returned an error: %s", encoded.JSON)
	}
	var envelope struct {
		SchemaVersion int               `json:"schema_version"`
		OK            bool              `json:"ok"`
		Tool          string            `json:"tool"`
		Result        GetTaskToolResult `json:"result"`
	}
	if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
		t.Fatalf("decode authoritative MCP read-back: %v", err)
	}
	assessment := envelope.Result.RecoveryAssessment
	last := envelope.Result.Task.LastOperation
	if envelope.SchemaVersion != 1 || !envelope.OK || envelope.Tool != ToolGetTask ||
		envelope.Result.Task.TaskID != fixture.source.TaskID ||
		envelope.Result.Task.Revision != fixture.source.Revision+1 || last == nil ||
		last.OperationID != fixture.request.RequestID || assessment == nil ||
		assessment.Classification != domain.RecoveryCompletedAndRecorded ||
		assessment.Operation.OperationID != fixture.request.RequestID ||
		assessment.Operation.ActionID != fixture.request.ActionID ||
		assessment.OperationPayloadDigest != last.PayloadDigest ||
		assessment.CommittedProof == nil || assessment.ActionRetrySafe {
		t.Fatalf("authoritative MCP read-back = %#v", envelope)
	}
	return envelope.Result
}

func countMCPRecoveryEvents(t *testing.T, fixture uncertainMCPFixture) (int, int) {
	t.Helper()
	database, err := sql.Open("sqlite", fixture.databasePath)
	if err != nil {
		t.Fatalf("open uncertain MCP event facts: %v", err)
	}
	defer database.Close()
	var total, matching int
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(fixture.source.TaskID),
	).Scan(&total); err != nil {
		t.Fatalf("read uncertain MCP event count: %v", err)
	}
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM task_events WHERE task_id = ? AND request_id = ?`,
		string(fixture.source.TaskID), string(fixture.request.RequestID),
	).Scan(&matching); err != nil {
		t.Fatalf("read uncertain MCP matching event count: %v", err)
	}
	return total, matching
}

func newMCPRecoveryRepository(t *testing.T) string {
	t.Helper()
	repositoryPath := filepath.Join(t.TempDir(), "repository")
	if err := os.MkdirAll(repositoryPath, 0o755); err != nil {
		t.Fatalf("create uncertain MCP repository: %v", err)
	}
	for _, arguments := range [][]string{
		{"init", "--initial-branch=main"},
		{"config", "user.name", "MCP Recovery Test"},
		{"config", "user.email", "mcp-recovery@example.invalid"},
	} {
		runMCPRecoveryGit(t, repositoryPath, arguments...)
	}
	if err := os.WriteFile(filepath.Join(repositoryPath, "README.md"), []byte("MCP recovery\n"), 0o644); err != nil {
		t.Fatalf("write uncertain MCP repository fixture: %v", err)
	}
	runMCPRecoveryGit(t, repositoryPath, "add", "README.md")
	runMCPRecoveryGit(t, repositoryPath, "commit", "-m", "initial MCP recovery fixture")
	return repositoryPath
}

func runMCPRecoveryGit(t *testing.T, repositoryPath string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repositoryPath}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("construct uncertain MCP Git fixture: %v: %s", err, output)
	}
}
