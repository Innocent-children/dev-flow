package mcp

import (
	"encoding/json"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"github.com/google/jsonschema-go/jsonschema"
)

type skillExample struct {
	Kind, Tool, Name, Path string
	Input                  json.RawMessage
}

func readSkillExamples(t *testing.T, host string) []skillExample {
	t.Helper()
	root := filepath.Join("..", "..", "packages", "codex", "plugin", "skills", "dev-flow")
	if host == "deepseek" {
		root = filepath.Join("..", "..", "packages", "deepseek", "skills", "dev-flow")
	}
	pattern := regexp.MustCompile("(?s)<!-- example:([a-z-]+) ([a-z_-]+) ([a-z_-]+) -->\\n```json\\n(.*?)\\n```")
	var examples []skillExample
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".md") {
			return err
		}
		text, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, match := range pattern.FindAllSubmatch([]byte(strings.ReplaceAll(string(text), "\r\n", "\n")), -1) {
			examples = append(examples, skillExample{string(match[1]), string(match[2]), string(match[3]), path, append([]byte(nil), match[4]...)})
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(examples) == 0 {
		t.Fatal("no executable Skill examples found")
	}
	return examples
}

func validateSkillSchema(t *testing.T, rawSchema, rawValue []byte) {
	t.Helper()
	var schema jsonschema.Schema
	if err := json.Unmarshal(rawSchema, &schema); err != nil {
		t.Fatal(err)
	}
	resolved, err := schema.Resolve(nil)
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if err := json.Unmarshal(rawValue, &value); err != nil {
		t.Fatal(err)
	}
	if err := resolved.Validate(value); err != nil {
		t.Fatal(err)
	}
}

func TestSkillMCPExamplesMatchCurrentContracts(t *testing.T) {
	for _, host := range []string{"codex", "deepseek"} {
		t.Run(host, func(t *testing.T) { validateSkillMCPExamples(t, host) })
	}
}

func validateSkillMCPExamples(t *testing.T, host string) {
	catalogByName := map[string]ToolDefinition{}
	for _, definition := range ToolCatalog() {
		catalogByName[definition.Name] = definition
	}
	seenTools := map[string]bool{}
	seenTransitions := map[domain.TransitionID]bool{}
	for _, example := range readSkillExamples(t, host) {
		if example.Kind != "mcp" && example.Kind != "mcp-output" {
			continue
		}
		t.Run(example.Tool+"/"+example.Name, func(t *testing.T) {
			definition, ok := catalogByName[example.Tool]
			if !ok {
				t.Fatalf("%s cites an unknown tool", example.Path)
			}
			if example.Kind == "mcp-output" {
				validateSkillSchema(t, definition.OutputSchema, example.Input)
				return
			}
			seenTools[example.Tool] = true
			var arguments map[string]any
			if err := json.Unmarshal(example.Input, &arguments); err != nil {
				t.Fatal(err)
			}
			if example.Tool != ToolServerInfo && arguments["host"] != host {
				t.Fatalf("wrong Host in %s", example.Path)
			}
			validateSkillSchema(t, definition.InputSchema, example.Input)
			if err := ValidateToolInput(example.Tool, example.Input); err != nil {
				t.Fatalf("%s: %v", example.Path, err)
			}
			if kind, ordinary := submissionKindForTool(example.Tool); ordinary {
				transition := validateSkillNodeFacts(t, kind, example.Input)
				seenTransitions[transition] = true
			}
		})
	}
	for name := range catalogByName {
		if !seenTools[name] {
			t.Errorf("no complete input example for %s", name)
		}
	}
	for _, transition := range workflow.StandardProcess().Transitions {
		if !seenTransitions[transition.TransitionID] {
			t.Errorf("no submission example for current transition %s", transition.TransitionID)
		}
	}
}

// Reconstruct the canonical test envelope so examples also pass the real semantic
// result validation. Production hydration remains owned by Application.
func validateSkillNodeFacts(t *testing.T, kind domain.ActionKind, raw []byte) domain.TransitionID {
	t.Helper()
	transition, err := skillNodeFactsError(t, kind, raw)
	if err != nil {
		t.Fatal(err)
	}
	return transition
}

func skillNodeFactsError(t *testing.T, kind domain.ActionKind, raw []byte) (domain.TransitionID, error) {
	t.Helper()
	var input struct {
		TransitionID  domain.TransitionID `json:"transition_id"`
		Summary       string              `json:"summary"`
		Reason        string              `json:"reason"`
		NodeResult    map[string]any      `json:"node_result"`
		MethodResults map[string]struct {
			Capability string `json:"capability"`
			Summary    string `json:"summary"`
		} `json:"method_results"`
	}
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatal(err)
	}
	node, err := workflow.NodeDefinitionForActionKind(workflow.StandardProcess(), kind)
	if err != nil {
		t.Fatal(err)
	}
	if baseline, ok := input.NodeResult["baseline"].(map[string]any); ok {
		if kind == domain.ActionCompleteDesign {
			baseline["requirements_revision"] = 1
		}
		if kind == domain.ActionCompleteTasks {
			baseline["design_revision"] = 1
		}
	}
	if kind == domain.ActionCompleteImplementation {
		input.NodeResult["task_plan_revision"] = 1
	}
	if kind == domain.ActionCompleteDelivery {
		input.NodeResult["automated_evidence_ids"] = []string{}
		input.NodeResult["manual_evidence_ids"] = []string{}
		input.NodeResult["test_record_id"] = ""
		input.NodeResult["comprehension_record_id"] = ""
		if input.TransitionID == "delivery_complete" {
			input.NodeResult["automated_evidence_ids"] = []string{"evidence-endpoint"}
			input.NodeResult["test_record_id"] = "test-example"
			input.NodeResult["comprehension_record_id"] = "comprehension-example"
		}
	}
	facts, err := json.Marshal(input.NodeResult)
	if err != nil {
		t.Fatal(err)
	}
	methods := []domain.MethodEvidence{}
	for _, step := range node.SemanticMethodSteps {
		result := input.MethodResults[string(step.StepID)]
		status := domain.MethodStepPlainFallback
		if result.Capability != "" {
			status = domain.MethodStepCompleted
		}
		methods = append(methods, domain.MethodEvidence{StepID: step.StepID, Status: status, Capability: result.Capability, Summary: result.Summary})
	}
	canonical, err := json.Marshal(workflow.StandardPayload{TransitionID: input.TransitionID, Summary: input.Summary, Reason: input.Reason, NodeResult: facts, Artifacts: []domain.ArtifactReference{}, MethodEvidence: methods})
	if err != nil {
		t.Fatal(err)
	}
	envelope, result, err := workflow.DecodeStandardPayload(node.NodeID, canonical)
	if err != nil {
		return input.TransitionID, err
	}
	return input.TransitionID, workflow.ValidatePayload(workflow.StandardProcess(), node.NodeID, envelope, result, node.SemanticMethodSteps)
}

func TestCodexSkillHostExamplesMatchPublishedHelp(t *testing.T) {
	// Read the same exported contracts used by the installed command's --help.
	command := exec.Command("node", "--input-type=module", "-e", `import {HOST_LAUNCH_OPERATIONS,hostLaunchHelp} from './packages/codex/lib/host-launch-contract.mjs'; process.stdout.write(JSON.stringify(Object.fromEntries(HOST_LAUNCH_OPERATIONS.map(name=>[name,JSON.parse(hostLaunchHelp(name)).input_schema]))));`)
	command.Dir = filepath.Join("..", "..")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("Node.js is required for Host contract checks: %v: %s", err, output)
	}
	var schemas map[string]json.RawMessage
	if err := json.Unmarshal(output, &schemas); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, example := range readSkillExamples(t, "codex") {
		if example.Kind != "host" {
			continue
		}
		t.Run(example.Tool+"/"+example.Name, func(t *testing.T) {
			schema, ok := schemas[example.Tool]
			if !ok {
				t.Fatalf("unknown Host operation in %s", example.Path)
			}
			validateSkillSchema(t, schema, example.Input)
			seen[example.Tool] = true
		})
	}
	for name := range schemas {
		if !seen[name] {
			t.Errorf("no complete input example for host-launch %s", name)
		}
	}
}

func TestDeepSeekSkillWorkspaceExamplesMatchRegisteredSchema(t *testing.T) {
	command := exec.Command("node", "--input-type=module", "-e", `import {registerWorkspaceCoordinator} from './packages/deepseek/lib/workspace-tool.mjs'; let tool; registerWorkspaceCoordinator({tools:{guard(){return ()=>{};},register(value){tool=value;return ()=>{};}}},{dataDirectory:'/private/tmp/example',workspaceRoot:'/work/project'}); process.stdout.write(JSON.stringify(tool.parameters));`)
	command.Dir = filepath.Join("..", "..")
	schema, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("DSH tool schema requires the installed development dependencies: %v: %s", err, schema)
	}
	for _, example := range readSkillExamples(t, "deepseek") {
		if example.Kind != "workspace" {
			continue
		}
		t.Run(example.Name, func(t *testing.T) { validateSkillSchema(t, schema, example.Input) })
	}
}
