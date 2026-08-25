package mcp

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestMCPContractGraphCatalogAndClosedSchemas(t *testing.T) {
	want := []string{ToolServerInfo, ToolOpenTask, ToolGetTask, ToolGetNextAction, ToolApplyAction, ToolCancelTask}
	got := ToolNames()
	if len(got) != 6 {
		t.Fatalf("tools=%d", len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("tool %d=%s", i, got[i])
		}
	}
	for _, d := range ToolCatalog() {
		var schema map[string]any
		if err := json.Unmarshal(d.InputSchema, &schema); err != nil {
			t.Fatal(err)
		}
		if schema["additionalProperties"] != false {
			t.Fatalf("%s schema open", d.Name)
		}
	}
	if err := ValidateToolInput(ToolGetTask, []byte(`{"host":"codex","task_id":"task","extra":true}`)); err == nil {
		t.Fatal("unknown field accepted")
	}
	var openSchema map[string]any
	if err := json.Unmarshal(catalog[1].InputSchema, &openSchema); err != nil {
		t.Fatal(err)
	}
	properties := openSchema["properties"].(map[string]any)
	additional := properties["additional_repositories"].(map[string]any)
	items := additional["items"].(map[string]any)
	if additional["maxItems"] != float64(domain.MaxAdditionalRepositories) || items["additionalProperties"] != false {
		t.Fatalf("additional repository schema=%#v", additional)
	}
	key := properties["primary_repository_key"].(map[string]any)
	if key["pattern"] != "^[a-z0-9][a-z0-9._-]{0,127}$" {
		t.Fatalf("primary repository key schema=%#v", key)
	}
}

func TestStandardNodeResultsRequireRepositoryMutationEnvelope(t *testing.T) {
	payloads, _ := graphPayloads()
	if len(payloads) != 9 {
		t.Fatalf("payloads=%d", len(payloads))
	}
	for index, name := range []string{"requirements", "design", "tasks", "implementation", "test", "comprehension", "refactor", "delivery"} {
		payload := payloads[index].(map[string]any)
		properties := payload["properties"].(map[string]any)
		nodeResult := properties["node_result"].(map[string]any)
		required := nodeResult["required"].([]string)
		if !containsSchemaMember(required, "changed_paths") || !containsSchemaMember(required, "no_file_changes") {
			t.Fatalf("%s required=%v", name, required)
		}
	}
}

func containsSchemaMember(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func TestMultiRepositoryTaskProjectionIsSortedAndUsesOneDigest(t *testing.T) {
	now := time.Date(2026, 8, 23, 7, 0, 0, 0, time.UTC)
	primary := graphContractBinding(now, "/core", 'a')
	api := graphContractBinding(now, "/api", 'b')
	docs := graphContractBinding(now, "/docs", 'c')
	task := domain.ProcessTask{
		PrimaryRepositoryKey: "core",
		Repository:           primary,
		AdditionalRepositories: []domain.RepositoryScopeEntry{
			{Key: "docs", Binding: docs},
			{Key: "api", Binding: api},
		},
	}
	effectiveTask := task
	effectiveTask.AdditionalRepositories = []domain.RepositoryScopeEntry{{Key: "api", Binding: api}, {Key: "docs", Binding: docs}}
	effective, err := effectiveTask.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &domain.ProcessAction{RepositoryBindingDigest: effective}
	raw, err := json.Marshal(projectTask(task))
	if err != nil {
		t.Fatal(err)
	}
	var projection map[string]any
	if json.Unmarshal(raw, &projection) != nil {
		t.Fatal("invalid task projection")
	}
	if projection["primary_repository_key"] != "core" || projection["repository"].(map[string]any)["canonical_root"] != "/core" {
		t.Fatalf("primary projection=%#v", projection)
	}
	additional, ok := projection["additional_repositories"].([]any)
	if !ok || len(additional) != 2 || additional[0].(map[string]any)["key"] != "api" || additional[1].(map[string]any)["key"] != "docs" {
		t.Fatalf("additional projection=%#v", projection["additional_repositories"])
	}
	if bytes.Count(raw, []byte(`"repository_binding_digest"`)) != 1 || bytes.Contains(raw, []byte("repository_scope_digest")) || !bytes.Contains(raw, []byte(effective)) {
		t.Fatalf("digest projection=%s", raw)
	}

	single := projectTask(domain.ProcessTask{Repository: primary}).(map[string]any)
	if single["primary_repository_key"] != domain.DefaultPrimaryRepositoryKey || single["repository"].(map[string]any)["canonical_root"] != "/core" {
		t.Fatalf("single repository projection=%#v", single)
	}
	if _, exists := single["additional_repositories"]; exists {
		t.Fatal("single repository projection added an empty collection")
	}
}

func TestOpenTaskMultiRepositoryWireMapsApplicationRequest(t *testing.T) {
	raw := []byte(`{"host":"codex","repository_path":"/core","primary_repository_key":"core","additional_repositories":[{"key":"docs","repository_path":"/docs"}],"new_task":{"request":"Build feature","initial_scope":[],"initial_out_of_scope":[],"known_acceptance_criteria":[],"verification_budget":{"level":"targeted","max_automatic_commands":1,"allow_full_suite":false,"allow_manual_handoff":false},"method_profile":"plain"}}`)
	if err := ValidateToolInput(ToolOpenTask, raw); err != nil {
		t.Fatal(err)
	}
	var wire openWire
	if err := decodeClosed(raw, &wire); err != nil {
		t.Fatal(err)
	}
	request := toOpen(wire, "request-mapped")
	if request.RequestID != "request-mapped" || request.RepositoryPath != "/core" || request.PrimaryRepositoryKey != "core" || len(request.AdditionalRepositories) != 1 || request.AdditionalRepositories[0].Key != "docs" || request.AdditionalRepositories[0].RepositoryPath != "/docs" || request.NewTask == nil {
		t.Fatalf("mapped request=%#v", request)
	}
}

func graphContractBinding(now time.Time, root string, marker byte) domain.RepositoryBinding {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	branch := "main"
	head := strings.Repeat(string(marker), 40)
	return domain.RepositoryBinding{CanonicalRoot: root, GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
}
