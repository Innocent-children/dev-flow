package contract_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"testing"
)

var fixtureREADMEReferencePattern = regexp.MustCompile("`([^`]+\\.json)`")

type sharedFixtureEnvelope struct {
	SchemaVersion int             `json:"schema_version"`
	OK            bool            `json:"ok"`
	RequestID     string          `json:"request_id"`
	Tool          string          `json:"tool"`
	Result        json.RawMessage `json:"result"`
	Error         json.RawMessage `json:"error"`
	Recovery      json.RawMessage `json:"recovery"`
}

type fixtureTask struct {
	TaskID        string            `json:"task_id"`
	Phase         string            `json:"phase"`
	Revision      uint64            `json:"revision"`
	Repository    fixtureRepository `json:"repository"`
	CurrentAction *fixtureAction    `json:"current_action"`
	Blocker       *fixtureBlocker   `json:"blocker"`
	Evidence      []fixtureEvidence `json:"evidence"`
	Outcome       *fixtureOutcome   `json:"outcome"`
	Contract      json.RawMessage   `json:"contract"`
	LastOperation json.RawMessage   `json:"last_operation"`
	ResumePhase   json.RawMessage   `json:"resume_phase"`
	CompletedAt   json.RawMessage   `json:"completed_at"`
	OriginHost    string            `json:"origin_host"`
	CreatedAt     string            `json:"created_at"`
	UpdatedAt     string            `json:"updated_at"`
}

type fixtureRepository struct {
	BindingDigest string `json:"binding_digest"`
}

type fixtureAction struct {
	ActionID                string `json:"action_id"`
	Kind                    string `json:"kind"`
	TaskID                  string `json:"task_id"`
	Revision                uint64 `json:"revision"`
	RepositoryBindingDigest string `json:"repository_binding_digest"`
}

type fixtureBlocker struct {
	BlockerID   string `json:"blocker_id"`
	ResumePhase string `json:"resume_phase"`
	Condition   struct {
		Kind                  string `json:"kind"`
		ExpectedBindingDigest string `json:"expected_binding_digest"`
	} `json:"condition"`
}

type fixtureEvidence struct {
	EvidenceID string `json:"evidence_id"`
	Source     string `json:"source"`
}

type fixtureOutcome struct {
	AutomatedEvidenceIDs []string `json:"automated_evidence_ids"`
	ManualEvidenceIDs    []string `json:"manual_evidence_ids"`
}

func TestSharedProtocolFixtureParity(t *testing.T) {
	t.Parallel()

	root := markdownRepositoryRoot(t)
	paths, err := filepath.Glob(filepath.Join(root, "protocol", "fixtures", "*.json"))
	if err != nil || len(paths) == 0 {
		t.Fatalf("enumerate shared fixtures: %v", err)
	}
	sort.Strings(paths)
	versionPlaceholders := 0
	for _, path := range paths {
		path := path
		t.Run(filepath.Base(path), func(t *testing.T) {
			contents, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}
			if err := validateCommittedEnvelope(contents); err != nil {
				t.Fatalf("fixture does not use the committed result envelope: %v", err)
			}
			var envelope sharedFixtureEnvelope
			if err := strictContractJSON(contents, &envelope); err != nil {
				t.Fatalf("decode fixture envelope: %v", err)
			}
			if envelope.SchemaVersion != 1 || envelope.RequestID == "" || !slices.Contains(coremcpToolNames(), envelope.Tool) {
				t.Fatalf("invalid fixture identity: %#v", envelope)
			}
			if envelope.OK {
				if len(envelope.Error) != 0 || len(envelope.Recovery) != 0 {
					t.Fatal("success fixture contains top-level error recovery")
				}
				assertFixtureSuccessParity(t, envelope.Tool, envelope.Result)
			} else {
				if len(envelope.Result) != 0 || len(envelope.Error) == 0 || len(envelope.Recovery) == 0 {
					t.Fatal("error fixture is not error-only")
				}
				assertErrorFixtureHasNoTaskOrPath(t, contents)
			}

			count := bytes.Count(contents, []byte("${VERSION}"))
			if count != 0 && filepath.Base(path) != "server-info.json" {
				t.Fatal("VERSION placeholder appears outside server-info fixture")
			}
			versionPlaceholders += count
			assertFixtureHasNoPrivateMaterial(t, contents)
		})
	}
	if versionPlaceholders != 1 {
		t.Fatalf("VERSION placeholder count = %d, want exactly 1", versionPlaceholders)
	}
	assertHostPackagesDoNotCopyFixtures(t, root, paths)
}

func TestFixtureREADMEReferencesExistingSharedFixtures(t *testing.T) {
	t.Parallel()

	root := markdownRepositoryRoot(t)
	fixtureDirectory := filepath.Join(root, "protocol", "fixtures")
	readme, err := os.ReadFile(filepath.Join(fixtureDirectory, "README.md"))
	if err != nil {
		t.Fatalf("read fixture README: %v", err)
	}
	referenced := make(map[string]struct{})
	for _, match := range fixtureREADMEReferencePattern.FindAllSubmatch(readme, -1) {
		name := string(match[1])
		referenced[name] = struct{}{}
		if _, err := os.Stat(filepath.Join(fixtureDirectory, name)); err != nil {
			t.Errorf("fixture README reference %q is missing: %v", name, err)
		}
	}
	paths, err := filepath.Glob(filepath.Join(fixtureDirectory, "*.json"))
	if err != nil {
		t.Fatalf("enumerate shared fixtures: %v", err)
	}
	for _, path := range paths {
		if _, exists := referenced[filepath.Base(path)]; !exists {
			t.Errorf("shared fixture %q is not documented in protocol/fixtures/README.md", filepath.Base(path))
		}
	}
}

func assertFixtureSuccessParity(t *testing.T, tool string, raw json.RawMessage) {
	t.Helper()
	var result map[string]json.RawMessage
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode fixture result: %v", err)
	}
	_, hasAssessment := result["recovery_assessment"]
	readTool := tool == "dev_flow_get_task" || tool == "dev_flow_get_next_action"
	if readTool != hasAssessment {
		t.Fatalf("recovery_assessment placement mismatch for %s", tool)
	}

	if taskRaw := result["task"]; len(taskRaw) != 0 {
		var task fixtureTask
		if err := json.Unmarshal(taskRaw, &task); err != nil {
			t.Fatalf("decode fixture task: %v", err)
		}
		assertFixtureTaskIdentity(t, task)
	}
	if actionRaw := result["action"]; len(actionRaw) != 0 && !bytes.Equal(actionRaw, []byte("null")) {
		var action fixtureAction
		if err := json.Unmarshal(actionRaw, &action); err != nil {
			t.Fatalf("decode next-action projection: %v", err)
		}
		var taskID, binding string
		var revision uint64
		_ = json.Unmarshal(result["task_id"], &taskID)
		_ = json.Unmarshal(result["revision"], &revision)
		binding = action.RepositoryBindingDigest
		if action.TaskID != taskID || action.Revision != revision || !validFixtureDigest(binding) {
			t.Fatalf("next-action identity is inconsistent: %#v", action)
		}
	}
}

func assertFixtureTaskIdentity(t *testing.T, task fixtureTask) {
	t.Helper()
	if task.TaskID == "" || task.Revision == 0 || !validFixtureDigest(task.Repository.BindingDigest) ||
		len(task.Contract) == 0 || len(task.LastOperation) == 0 || task.OriginHost == "" ||
		task.CreatedAt == "" || task.UpdatedAt == "" {
		t.Fatalf("incomplete task projection: %#v", task)
	}
	if task.CurrentAction != nil {
		if task.CurrentAction.TaskID != task.TaskID || task.CurrentAction.Revision != task.Revision ||
			task.CurrentAction.RepositoryBindingDigest != task.Repository.BindingDigest {
			t.Fatalf("task/action identity mismatch: task %#v action %#v", task, task.CurrentAction)
		}
	}
	if task.Blocker != nil {
		if task.Phase != "BLOCKED" || task.CurrentAction == nil || task.CurrentAction.Kind != "RESOLVE_BLOCKER" ||
			task.Blocker.Condition.Kind != "restore_issuance_binding" ||
			task.Blocker.Condition.ExpectedBindingDigest != task.Repository.BindingDigest {
			t.Fatalf("invalid blocker projection: %#v", task.Blocker)
		}
	}
	if task.Outcome != nil {
		sources := make(map[string]string, len(task.Evidence))
		for _, evidence := range task.Evidence {
			if _, duplicate := sources[evidence.EvidenceID]; duplicate || evidence.EvidenceID == "" {
				t.Fatalf("duplicate or empty evidence ID %q", evidence.EvidenceID)
			}
			sources[evidence.EvidenceID] = evidence.Source
		}
		for _, id := range task.Outcome.AutomatedEvidenceIDs {
			if sources[id] != "automated" {
				t.Fatalf("automated outcome evidence %q resolves to %q", id, sources[id])
			}
		}
		for _, id := range task.Outcome.ManualEvidenceIDs {
			if sources[id] != "user" {
				t.Fatalf("manual outcome evidence %q resolves to %q", id, sources[id])
			}
		}
	}
}

func assertErrorFixtureHasNoTaskOrPath(t *testing.T, contents []byte) {
	t.Helper()
	var value map[string]json.RawMessage
	if err := json.Unmarshal(contents, &value); err != nil {
		t.Fatalf("decode error fixture: %v", err)
	}
	for _, forbidden := range []string{"result", "task", "repository_path", "canonical_root", "database_path"} {
		if _, exists := value[forbidden]; exists {
			t.Errorf("error fixture exposes forbidden top-level member %q", forbidden)
		}
	}
	if bytes.Contains(contents, []byte(`"canonical_root"`)) || bytes.Contains(contents, []byte(`"task_id"`)) {
		t.Fatal("error fixture contains a task or repository path projection")
	}
}

func assertFixtureHasNoPrivateMaterial(t *testing.T, contents []byte) {
	t.Helper()
	lower := strings.ToLower(string(contents))
	for _, forbidden := range []string{
		"/users/", "\\users\\", "dev_flow_data_dir", `"database_path"`, ".sqlite", ".db\"",
		`"source_content"`, `"diff"`, `"raw_status"`, `"environment"`, `"command"`, `"raw_output"`,
	} {
		if strings.Contains(lower, forbidden) {
			t.Errorf("fixture contains private/raw material marker %q", forbidden)
		}
	}
}

func assertHostPackagesDoNotCopyFixtures(t *testing.T, root string, fixturePaths []string) {
	t.Helper()
	names := make(map[string]struct{}, len(fixturePaths))
	for _, path := range fixturePaths {
		names[filepath.Base(path)] = struct{}{}
	}
	for _, host := range []string{"codex", "deepseek"} {
		hostRoot := filepath.Join(root, "packages", host)
		err := filepath.WalkDir(hostRoot, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() && entry.Name() == "fixtures" {
				return fmt.Errorf("host package %s owns a fixtures directory", host)
			}
			if !entry.IsDir() {
				if _, copied := names[entry.Name()]; copied {
					return fmt.Errorf("host package %s copies shared fixture %s", host, entry.Name())
				}
			}
			return nil
		})
		if err != nil {
			t.Error(err)
		}
	}
}

func coremcpToolNames() []string {
	return []string{
		"dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task",
		"dev_flow_get_next_action", "dev_flow_apply_action", "dev_flow_cancel_task",
	}
}
