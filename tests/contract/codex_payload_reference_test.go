package contract_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	core "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

type codexPayloadTemplateContract struct {
	Name       string
	Node       domain.NodeID
	ActionKind domain.ActionKind
}

func TestCodexNodePayloadReferenceUsesCurrentDecoders(t *testing.T) {
	t.Parallel()
	referencePath := filepath.Join(markdownRepositoryRoot(t), "packages", "codex", "plugin", "skills", "dev-flow", "references", "node-payloads.md")
	reference, err := os.ReadFile(referencePath)
	if err != nil {
		t.Fatal(err)
	}
	contracts := []codexPayloadTemplateContract{
		{Name: "requirements", Node: domain.NodeRequirements, ActionKind: domain.ActionCompleteRequirements},
		{Name: "design", Node: domain.NodeDesign, ActionKind: domain.ActionCompleteDesign},
		{Name: "tasks", Node: domain.NodeTasks, ActionKind: domain.ActionCompleteTasks},
		{Name: "implement", Node: domain.NodeImplement, ActionKind: domain.ActionCompleteImplementation},
		{Name: "test", Node: domain.NodeTest, ActionKind: domain.ActionCompleteTest},
		{Name: "comprehension-complexity", Node: domain.NodeComprehensionReview, ActionKind: domain.ActionCompleteComprehensionReview},
		{Name: "comprehension-passed", Node: domain.NodeComprehensionReview, ActionKind: domain.ActionCompleteComprehensionReview},
		{Name: "refactor", Node: domain.NodeRefactor, ActionKind: domain.ActionCompleteRefactor},
		{Name: "delivery", Node: domain.NodeDelivery, ActionKind: domain.ActionCompleteDelivery},
	}
	for _, contract := range contracts {
		t.Run(contract.Name, func(t *testing.T) {
			raw := extractCodexPayloadTemplate(t, reference, contract.Name)
			definition, found := finalLocalNodeDefinition(contract.Node)
			if !found || definition.ActionKind != contract.ActionKind {
				t.Fatalf("%s does not map to current Action %s/%s", contract.Name, contract.Node, contract.ActionKind)
			}
			assertFinalLocalPayloadCommonShape(t, raw)
			if err := validateFinalLocalPayload(contract.Node, raw); err != nil {
				t.Fatalf("packaged %s template fails current workflow validation: %v", contract.Name, err)
			}
			if err := core.ValidateToolInput(core.ToolApplyAction, codexTemplateApplyInput(t, contract, raw)); err != nil {
				t.Fatalf("packaged %s template fails current MCP input validation: %v", contract.Name, err)
			}
			assertCodexTemplateMethodSteps(t, raw, definition)
		})
	}
	blocked := extractCodexPayloadTemplate(t, reference, "blocked")
	if _, _, err := recovery.DecodeBlockerResolutionPayload(blocked); err != nil {
		t.Fatalf("packaged blocker template fails current blocker decoder: %v", err)
	}
	blockedContract := codexPayloadTemplateContract{Name: "blocked", Node: domain.NodeBlocked, ActionKind: domain.ActionResolveBlocker}
	if err := core.ValidateToolInput(core.ToolApplyAction, codexTemplateApplyInput(t, blockedContract, blocked)); err != nil {
		t.Fatalf("packaged blocker template fails current MCP input validation: %v", err)
	}
	var blocker map[string]any
	if err := json.Unmarshal(blocked, &blocker); err != nil {
		t.Fatal(err)
	}
	if _, found := blocker["destination"]; found {
		t.Fatal("packaged blocker template contains destination")
	}
}

func codexTemplateApplyInput(t *testing.T, contract codexPayloadTemplateContract, payload json.RawMessage) []byte {
	t.Helper()
	input := map[string]any{
		"request_id":                "request-node-payload-template",
		"host":                      "codex",
		"task_id":                   "task-node-payload-template",
		"revision":                  1,
		"action_id":                 "action-node-payload-template",
		"action_kind":               contract.ActionKind,
		"process_id":                "standard-development",
		"process_version":           1,
		"process_definition_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"source_cursor":             contract.Node,
		"repository_binding_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"payload":                   json.RawMessage(payload),
	}
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestCodexNodePayloadReferenceDocumentsOperationalBoundaries(t *testing.T) {
	t.Parallel()
	path := filepath.Join(markdownRepositoryRoot(t), "packages", "codex", "plugin", "skills", "dev-flow", "references", "node-payloads.md")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, required := range []string{
		"`repository_observation` is a Core evidence requirement, not an ArtifactReference role",
		"\"artifacts\": []",
		"Never submit `destination`, `next_node`",
		"plain_fallback",
		"INVALID_ARGUMENT",
		"complexity_justification",
		"requirements_revision",
		"Acceptance order/text",
		"Never submit a resume node or destination",
	} {
		if !regexp.MustCompile(regexp.QuoteMeta(required)).MatchString(text) {
			t.Errorf("node payload reference missing boundary %q", required)
		}
	}
}

func TestContract02MutationRequestBindingIsExplicit(t *testing.T) {
	t.Parallel()
	path := filepath.Join(markdownRepositoryRoot(t), "specs", "008-refactor-to-development-process-graph", "contracts", "mcp-tools-0.2.md")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, required := range []string{
		"for `dev_flow_apply_action` and `dev_flow_cancel_task`, it equals the valid caller-provided",
		"`Task.LastOperation.operation_id` and `TaskEvent.request_id`",
		"tools without a caller-provided `request_id` use a Core-generated local transport request",
		"mismatch is a contract failure and must not be silently ignored",
	} {
		if !regexp.MustCompile(regexp.QuoteMeta(required)).MatchString(text) {
			t.Errorf("Contract 0.2 missing request-binding rule %q", required)
		}
	}
}

func extractCodexPayloadTemplate(t *testing.T, reference []byte, name string) json.RawMessage {
	t.Helper()
	pattern := regexp.MustCompile(`(?s)<!-- node-payload-template:` + regexp.QuoteMeta(name) + `:start -->\s*` + "```json" + `\s*(\{.*?\})\s*` + "```" + `\s*<!-- node-payload-template:` + regexp.QuoteMeta(name) + `:end -->`)
	match := pattern.FindSubmatch(reference)
	if len(match) != 2 || !json.Valid(match[1]) {
		t.Fatalf("node payload reference template %q is missing or invalid JSON", name)
	}
	var value any
	if err := json.Unmarshal(match[1], &value); err != nil {
		t.Fatal(err)
	}
	materializeCodexPayloadPlaceholders(value)
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func materializeCodexPayloadPlaceholders(value any) {
	switch current := value.(type) {
	case map[string]any:
		for key, child := range current {
			if text, ok := child.(string); ok {
				current[key] = strings.ReplaceAll(text, "placeholder", "current")
				continue
			}
			materializeCodexPayloadPlaceholders(child)
		}
	case []any:
		for index, child := range current {
			if text, ok := child.(string); ok {
				current[index] = strings.ReplaceAll(text, "placeholder", "current")
				continue
			}
			materializeCodexPayloadPlaceholders(child)
		}
	}
}

func assertCodexTemplateMethodSteps(t *testing.T, raw []byte, definition domain.NodeDefinition) {
	t.Helper()
	var payload struct {
		Artifacts []domain.ArtifactReference `json:"artifacts"`
		Methods   []domain.MethodEvidence    `json:"method_evidence"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Artifacts) != 0 {
		t.Fatal("packaged node template unexpectedly requires an artifact")
	}
	actual := make([]domain.MethodStepID, len(payload.Methods))
	for index, evidence := range payload.Methods {
		actual[index] = evidence.StepID
		if evidence.Status != domain.MethodStepPlainFallback || evidence.Capability != "" {
			t.Fatalf("method evidence %d is not plain_fallback with empty capability", index)
		}
	}
	expected := make([]domain.MethodStepID, len(definition.SemanticMethodSteps))
	for index, step := range definition.SemanticMethodSteps {
		expected[index] = step.StepID
	}
	if !slices.Equal(actual, expected) {
		t.Fatalf("method steps = %v, want %v", actual, expected)
	}
}
