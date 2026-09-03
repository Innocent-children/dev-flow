package workflow

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestActionPayloadSchemasCoverEveryCurrentActionKind(t *testing.T) {
	entries := ActionPayloadSchemas()
	want := []domain.ActionKind{
		domain.ActionCompleteRequirements, domain.ActionCompleteDesign, domain.ActionCompleteTasks,
		domain.ActionCompleteImplementation, domain.ActionCompleteTest, domain.ActionCompleteComprehensionReview,
		domain.ActionCompleteRefactor, domain.ActionCompleteDelivery, domain.ActionResolveBlocker,
	}
	if len(entries) != len(want) {
		t.Fatalf("schemas=%d want=%d", len(entries), len(want))
	}
	for index, entry := range entries {
		if entry.Kind != want[index] {
			t.Fatalf("schema[%d]=%s want=%s", index, entry.Kind, want[index])
		}
		if entry.Schema["type"] != "object" || entry.Schema["additionalProperties"] != false {
			t.Fatalf("schema[%s] is not closed: %#v", entry.Kind, entry.Schema)
		}
	}
}

func TestActionPayloadSchemaForNarrowsCurrentTransitions(t *testing.T) {
	now := time.Date(2026, 8, 26, 14, 0, 0, 0, time.UTC)
	workspace := domain.WorkspaceDigests{
		Binding: domain.Digest(strings.Repeat("a", 64)), Identity: domain.Digest(strings.Repeat("b", 64)),
		History: domain.Digest(strings.Repeat("c", 64)), Content: domain.Digest(strings.Repeat("d", 64)),
	}
	definition := StandardProcess()
	for _, node := range definition.Nodes {
		if node.NodeID.Terminal() {
			continue
		}
		action, err := BuildProcessActionForWorkspace(definition, node.NodeID, "task", 1, workspace, domain.MethodPlain, domain.ID("action-"+strings.ToLower(string(node.NodeID))), now)
		if err != nil {
			t.Fatalf("build %s: %v", node.NodeID, err)
		}
		if action.RepositoryBindingDigest != workspace.Binding || action.IssuanceIdentityDigest != workspace.Identity || action.IssuanceHistoryDigest != workspace.History || action.IssuanceContentDigest != workspace.Content {
			t.Fatalf("%s lost issuance workspace digests: %#v", node.NodeID, action)
		}
		raw, err := ActionPayloadSchemaFor(action)
		if err != nil {
			t.Fatalf("schema %s: %v", action.Kind, err)
		}
		var schema map[string]any
		if json.Unmarshal(raw, &schema) != nil || schema["additionalProperties"] != false {
			t.Fatalf("schema %s is invalid: %s", action.Kind, raw)
		}
		if action.Kind == domain.ActionResolveBlocker {
			continue
		}
		properties := schema["properties"].(map[string]any)
		transition := properties["transition_id"].(map[string]any)
		values := transition["enum"].([]any)
		if len(values) != len(action.AvailableTransitions) {
			t.Fatalf("%s transitions=%v want=%v", action.Kind, values, action.AvailableTransitions)
		}
		for index, available := range action.AvailableTransitions {
			if values[index] != string(available.TransitionID) {
				t.Fatalf("%s transition[%d]=%v want=%s", action.Kind, index, values[index], available.TransitionID)
			}
		}
	}
}
