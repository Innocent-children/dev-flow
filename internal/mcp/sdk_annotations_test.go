package mcp

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
	"testing"
)

type annotationStore struct{}

func (annotationStore) LoadTask(context.Context, domain.ID) (domain.ProcessTask, error) {
	return domain.ProcessTask{}, store.ErrTaskNotFound
}
func (annotationStore) LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error) {
	return domain.ProcessTask{}, store.ErrTaskNotFound
}
func (annotationStore) CommitTask(context.Context, store.TaskMutation) error { return nil }

type annotationObserver struct{}

func (annotationObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return domain.RepositoryBinding{}, repository.ErrNotGitRepository
}
func TestSDKRegisteredToolAnnotationsMatchContract(t *testing.T) {
	service, err := application.NewService(annotationStore{}, annotationObserver{})
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(service, "test", nil)
	if err != nil {
		t.Fatal(err)
	}
	serverTransport, clientTransport := sdk.NewInMemoryTransports()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go server.Run(ctx, serverTransport)
	client := sdk.NewClient(&sdk.Implementation{Name: "contract-test", Version: "1"}, nil)
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	listed, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed.Tools) != len(ToolNames()) {
		t.Fatalf("tools=%d", len(listed.Tools))
	}
	for _, tool := range listed.Tools {
		var expected ToolAnnotations
		for _, definition := range catalog {
			if definition.Name == tool.Name {
				expected = definition.Annotations
			}
		}
		a := tool.Annotations
		if a == nil || a.ReadOnlyHint != expected.ReadOnly || a.IdempotentHint != expected.Idempotent || a.DestructiveHint == nil || *a.DestructiveHint != expected.Destructive || a.OpenWorldHint == nil || *a.OpenWorldHint != expected.OpenWorld {
			t.Fatalf("SDK annotations %s %#v", tool.Name, a)
		}
	}
}
