package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// The recipe changes the preceding valid request into the failure described in
// the manual. Expected responses are compared with production validation/encoding.
type skillErrorCase struct {
	Operation string          `json:"operation"`
	Path      string          `json:"path,omitempty"`
	Value     json.RawMessage `json:"value,omitempty"`
}

func TestEverySkillMCPRequestHasAnAccurateAdjacentError(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		t.Run(host, func(t *testing.T) {
			server := missingTaskSkillServer(t)
			for _, request := range readSkillExamples(t, host) {
				if request.Kind != "mcp" {
					continue
				}
				t.Run(request.Tool+"/"+request.Name, func(t *testing.T) {
					paired, recipe := adjacentSkillError(t, request)
					actual := runSkillErrorCase(t, server, request, recipe)
					if !actual.IsError {
						t.Fatal("the documented failure condition succeeded")
					}
					var expectedValue, actualValue any
					if err := json.Unmarshal(paired, &expectedValue); err != nil {
						t.Fatal(err)
					}
					if err := json.Unmarshal(actual.JSON, &actualValue); err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(expectedValue, actualValue) {
						t.Fatalf("Core error response for %s/%s: %s", request.Tool, request.Name, actual.JSON)
					}
					validateSkillSchema(t, mustSchemaJSON(t, toolOutputSchema(request.Tool)), paired)
				})
			}
		})
	}
}

func TestDocumentedErrorsSurviveMCPTransport(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		for _, request := range readSkillExamples(t, host) {
			if request.Kind != "mcp" || !(request.Tool == ToolServerInfo || request.Tool == ToolGetTask || request.Tool == ToolSubmitRequirements) {
				continue
			}
			t.Run(host+"/"+request.Tool, func(t *testing.T) {
				paired, recipe := adjacentSkillError(t, request)
				input := request.Input
				if recipe.Operation != "missing_task" {
					input = mutateSkillRequest(t, input, recipe)
				}
				base := missingTaskSkillServer(t)
				server, err := NewServer(base.application, "test", &ServerOptions{NewRequestID: func() (domain.ID, error) { return "request-error-example", nil }})
				if err != nil {
					t.Fatal(err)
				}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				serverTransport, clientTransport := sdk.NewInMemoryTransports()
				go server.Run(ctx, serverTransport)
				client := sdk.NewClient(&sdk.Implementation{Name: "skill-error-test", Version: "1"}, nil)
				session, err := client.Connect(ctx, clientTransport, nil)
				if err != nil {
					t.Fatal(err)
				}
				defer session.Close()
				result, err := session.CallTool(ctx, &sdk.CallToolParams{Name: request.Tool, Arguments: json.RawMessage(input)})
				if err != nil {
					t.Fatal(err)
				}
				if !result.IsError || len(result.Content) != 1 {
					t.Fatalf("unexpected MCP response: %+v", result)
				}
				content, ok := result.Content[0].(*sdk.TextContent)
				if !ok {
					t.Fatal("Core error text was not retained")
				}
				var actual, expected any
				if err := json.Unmarshal([]byte(content.Text), &actual); err != nil {
					t.Fatal(err)
				}
				if err := json.Unmarshal(paired, &expected); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(actual, expected) {
					t.Fatalf("transport changed documented response: %s", content.Text)
				}
			})
		}
	}
}

func TestSharedStandaloneSkillErrorsMatchCoreEncoder(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		for _, example := range readSkillExamples(t, host) {
			if example.Kind != "mcp-output" || strings.HasSuffix(example.Name, "-error") {
				continue
			}
			t.Run(host+"/"+example.Name, func(t *testing.T) {
				var expected Envelope
				if err := json.Unmarshal(example.Input, &expected); err != nil {
					t.Fatal(err)
				}
				if expected.OK || expected.Error == nil {
					t.Fatal("shared example must be an error")
				}
				failure := sharedSkillErrorCondition(t, host, example.Name)
				if failure == nil {
					t.Fatal("shared error condition succeeded")
				}
				actual := EncodeError(expected.RequestID, example.Tool, failure)
				var actualValue, expectedValue any
				if err := json.Unmarshal(actual.JSON, &actualValue); err != nil {
					t.Fatal(err)
				}
				if err := json.Unmarshal(example.Input, &expectedValue); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(actualValue, expectedValue) {
					t.Fatalf("Core shared error response for %s/%s: %s", example.Tool, example.Name, actual.JSON)
				}
			})
		}
	}
}

func adjacentSkillError(t *testing.T, request skillExample) (json.RawMessage, skillErrorCase) {
	t.Helper()
	contents, err := os.ReadFile(request.Path)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(contents), "\r\n", "\n")
	requestPattern := regexp.MustCompile(`(?s)<!-- example:mcp ` + regexp.QuoteMeta(request.Tool) + ` ` + regexp.QuoteMeta(request.Name) + ` -->\n` + "```json\n.*?\n```")
	location := requestPattern.FindStringIndex(text)
	if location == nil {
		t.Fatal("request example not found")
	}
	tail := text[location[1]:]
	nextPattern := regexp.MustCompile("(?s)<!-- example:([a-z-]+) ([a-z_-]+) ([a-z_-]+) -->\\n```json\\n(.*?)\\n```")
	next := nextPattern.FindStringSubmatchIndex(tail)
	if next == nil {
		t.Fatal("request has no following error response")
	}
	part := func(i int) string { return tail[next[2*i]:next[2*i+1]] }
	if part(1) != "mcp-output" || part(2) != request.Tool || part(3) != request.Name+"-error" {
		t.Fatal("the next example must be this request's error response")
	}
	preamble := tail[:next[0]]
	if !strings.Contains(preamble, "Possible error for this request:") || !strings.Contains(preamble, "Implementation:") {
		t.Fatal("paired response needs a failure condition and implementation references")
	}
	condition := regexp.MustCompile(`<!-- error-case: (\{[^\n]+\}) -->`).FindStringSubmatch(preamble)
	if len(condition) != 2 {
		t.Fatal("paired response needs one executable failure condition")
	}
	var recipe skillErrorCase
	decoder := json.NewDecoder(strings.NewReader(condition[1]))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&recipe); err != nil {
		t.Fatal(err)
	}
	return json.RawMessage(part(4)), recipe
}

func runSkillErrorCase(t *testing.T, server *Server, request skillExample, recipe skillErrorCase) EncodedResult {
	t.Helper()
	if recipe.Operation == "missing_task" {
		if recipe.Path != "" || len(recipe.Value) != 0 {
			t.Fatal("missing_task uses the unchanged request")
		}
		return server.dispatch(context.Background(), request.Tool, "request-error-example", request.Input)
	}

	var original struct {
		Host string `json:"host"`
	}
	if err := json.Unmarshal(request.Input, &original); err != nil {
		t.Fatal(err)
	}
	scenario := newSkillScenario(t, original.Host, readSkillExamples(t, original.Host))
	scenario.prepare(request)
	raw := mutateSkillRequest(t, scenario.bind(request), recipe)
	return scenario.server.dispatch(context.Background(), request.Tool, "request-error-example", raw)
}

func mutateSkillRequest(t *testing.T, raw json.RawMessage, recipe skillErrorCase) json.RawMessage {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatal(err)
	}
	original, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(recipe.Path, ".")
	if recipe.Path == "" {
		t.Fatal("mutation needs a field path")
	}
	current := value
	for _, part := range parts[:len(parts)-1] {
		switch container := current.(type) {
		case map[string]any:
			var exists bool
			current, exists = container[part]
			if !exists {
				t.Fatalf("unknown condition path %s", recipe.Path)
			}
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(container) {
				t.Fatal("invalid condition array position")
			}
			current = container[index]
		default:
			t.Fatal("condition path does not traverse an object or array")
		}
	}
	object, ok := current.(map[string]any)
	if !ok {
		t.Fatal("condition target must be an object member")
	}
	name := parts[len(parts)-1]
	switch recipe.Operation {
	case "remove":
		if _, present := object[name]; !present {
			t.Fatal("condition removes an absent member")
		}
		delete(object, name)
	case "set":
		var replacement any
		if err := json.Unmarshal(recipe.Value, &replacement); err != nil {
			t.Fatal(err)
		}
		object[name] = replacement
	default:
		t.Fatalf("unknown condition operation %s", recipe.Operation)
	}
	mutated, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(mutated, original) {
		t.Fatal("condition did not change the request")
	}
	return mutated
}

func missingTaskSkillServer(t *testing.T) *Server {
	t.Helper()
	database, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "empty-core.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := database.Close(); err != nil {
			t.Error(err)
		}
	})
	service, err := application.NewService(database, skillErrorObserver{})
	if err != nil {
		t.Fatal(err)
	}
	return &Server{application: service, version: "test"}
}

type skillErrorObserver struct{}

func (skillErrorObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	panic("error examples must stop before repository observation")
}

func sharedSkillErrorCondition(t *testing.T, host, name string) error {
	t.Helper()
	if name == "budget-exceeded" {
		previous := domain.EvidenceSummary{EvidenceID: "prior-verification", TaskPlanRevision: 1, Source: domain.EvidenceSourceAutomated, Name: "previous-checks", Status: domain.EvidencePassed, Summary: "Previous verification completed.", Digest: domain.Digest(strings.Repeat("a", 64)), CommandCount: 8, RecordedAt: time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)}
		return workflow.EvaluateVerificationBudget(domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 13}, 1, []domain.EvidenceSummary{previous}, []workflow.EvidenceInput{{Source: domain.EvidenceSourceAutomated, Name: "additional-checks", Status: domain.EvidencePassed, Summary: "Additional verification completed.", CommandCount: 6}}, nil)
	}
	requestName, path := "", ""
	switch name {
	case "budget-checks-correction":
		requestName, path = "verification_budget_increased", "node_result.budget_adjustment.additional_checks"
	case "guard-rejection":
		requestName, path = "tests_failed_implementation", "node_result.findings"
	default:
		t.Fatalf("shared response %s needs an executable failure condition", name)
	}
	for _, request := range readSkillExamples(t, host) {
		if request.Kind == "mcp" && request.Tool == ToolSubmitTest && request.Name == requestName {
			raw := mutateSkillRequest(t, request.Input, skillErrorCase{Operation: "set", Path: path, Value: json.RawMessage(`[]`)})
			if err := ValidateToolInput(request.Tool, raw); err != nil {
				return err
			}
			_, err := skillNodeFactsError(t, domain.ActionCompleteTest, raw)
			return err
		}
	}
	t.Fatal("missing source request for shared error condition")
	return nil
}
