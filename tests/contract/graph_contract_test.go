package contract_test

import (
	"encoding/json"
	"fmt"
	"github.com/Innocent-children/dev-flow/internal/domain"
	coremcp "github.com/Innocent-children/dev-flow/internal/mcp"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGraphContractCatalogAndFixtures(t *testing.T) {
	if len(coremcp.ToolNames()) != 6 {
		t.Fatal("tool catalog changed")
	}
	root := markdownRepositoryRoot(t)
	for _, name := range []string{"graph-server-info.json", "graph-open-requirements.json", "graph-design-action.json", "graph-invalid-edge.json"} {
		raw, err := os.ReadFile(filepath.Join(root, "protocol", "fixtures", name))
		if err != nil {
			t.Fatal(err)
		}
		var value map[string]any
		if json.Unmarshal(raw, &value) != nil {
			t.Fatalf("invalid %s", name)
		}
	}
}
func TestGraphContractMethodEvidenceSemantics(t *testing.T) {
	digest := workflow.StandardProcess().Reference.DefinitionDigest
	binding := strings.Repeat("a", 64)
	evidence := `[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured requirements."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified requirements."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated requirements."}]`
	payload := `{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":` + evidence + `,"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`
	request := func(value string) []byte {
		return []byte(fmt.Sprintf(`{"request_id":"request","host":"codex","task_id":"task","revision":1,"action_id":"action","action_kind":"COMPLETE_REQUIREMENTS","process_id":"standard-development","process_definition_digest":"%s","source_cursor":"REQUIREMENTS","repository_binding_digest":"%s","payload":%s}`, digest, binding, value))
	}
	if err := coremcp.ValidateToolInput(coremcp.ToolApplyAction, request(payload)); err != nil {
		t.Fatal(err)
	}
	empty := strings.Replace(payload, evidence, `[]`, 1)
	if err := coremcp.ValidateToolInput(coremcp.ToolApplyAction, request(empty)); err != domain.ErrTransitionNotAllowed {
		t.Fatalf("empty evidence error=%v", err)
	}
	unavailable := strings.Replace(payload, `"status":"plain_fallback"`, `"status":"unavailable"`, 1)
	if err := coremcp.ValidateToolInput(coremcp.ToolApplyAction, request(unavailable)); err != domain.ErrTransitionNotAllowed {
		t.Fatalf("unavailable evidence error=%v", err)
	}
	unknown := strings.Replace(payload, `requirements.capture`, `design.choose_approach`, 1)
	if err := coremcp.ValidateToolInput(coremcp.ToolApplyAction, request(unknown)); err != domain.ErrInvalidArgument {
		t.Fatalf("unknown evidence error=%v", err)
	}
}
func TestFixtureContractGraphInputsAreClosed(t *testing.T) {
	if err := coremcp.ValidateToolInput(coremcp.ToolGetTask, []byte(`{"host":"codex","task_id":"task","operation_probe":null}`)); err != nil {
		t.Fatal(err)
	}
	if err := coremcp.ValidateToolInput(coremcp.ToolGetTask, []byte(`{"host":"codex","task_id":"task","operation_probe":null,"destination":"DONE"}`)); err == nil {
		t.Fatal("caller destination accepted")
	}
}
