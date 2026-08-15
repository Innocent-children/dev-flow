package contract_test

import (
	"bytes"
	"crypto/sha256"
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

const (
	sharedFixtureCount           = 22
	sharedFixtureAggregateSHA256 = "8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7"
)

var sharedFixtureSHA256 = map[string]string{
	"active-task-conflict.json":              "8c3d8f3263d636a7164124fd7795d9dc850ab58a9582b57914ca55e95c9ae640",
	"apply-success.json":                     "6c80828fc972768758a3a92897fc65010f4381fa52a3a17516fd2bbc94cf2bc2",
	"cancelled-outcome.json":                 "e2055d6b6de98fe9c55e9e9c09fa7ca3ae4f2ba0f68abc38a2fd32f678fd8565",
	"completed-outcome.json":                 "3cdea40e0e65f14ac43d048bcda0995d26c79de1bb04944356b0d8a93bd2f533",
	"host-ownership-conflict.json":           "447484d26c01df2f7d443bbc607cf82618a94b1b7495f88b5b4bfc8aa426b6d9",
	"next-action.json":                       "187ad2c3406fb1be9a066fb9ebf6e77c1fc359f7371f2c13e22a18e9b8b9149e",
	"open-task.json":                         "c2d7ecd22b06cb952eb8cc3a6287142ea2c383ceafad432ae519560d5d124ea1",
	"recovery-apply-read-back.json":          "acaccd92b23738b4d159149d3afed2f4f63e6a41ea14c88ec50d250903948e9a",
	"recovery-blocked.json":                  "8c06c12c023fe17c7990e31b286d1768f3afcba2dbb868653add649f06f3be43",
	"recovery-completed-and-recorded.json":   "d2a1754b6f99b2e5daeb73d241230cab7d3266c96c7feb1dc2bf20dd40d2e76e",
	"recovery-completed-but-unrecorded.json": "dbec730091fd54ba5efeb87f83cdb6bb7586d05a7b3b15dc782c356d9daedf7a",
	"recovery-conflicting.json":              "d4a884cc6eb3e86332ad24eb3e97de9945d980174612c559153def0f41231720",
	"recovery-not-started.json":              "cc1b94a0180843ac15f9e25ca5717c62e54da474d873c1e3dffb23171a7e5811",
	"recovery-partially-completed.json":      "099601b9ee83c15d74bb05b2f0078d330f9068887ff4cebd8045851bc10272a1",
	"recovery-resolved.json":                 "56c131beb0bc5c08595acc9ca6ae8cfd061c55357165a67d01869229fcbf9ea8",
	"repository-drift.json":                  "d76b0098114ba82413536ce42f30e10526432ece06dcd38e9a88e30ab16a0c77",
	"revision-conflict.json":                 "d9de4f9fa4355ff2aa997871e186e36bafc44c1452af67584a52af66a81b906c",
	"rework.json":                            "963f5ba6841fecff1292508ddb1178544c29e6c53933cadbc2941ae3d5a63980",
	"server-info.json":                       "e9f10918a6c9e8547bdb9c249f54ee9a12bc830ea9c80ee7e06bc04bd09caee7",
	"stale-action.json":                      "59924a16e61fbe5937d58a249262ff33f0390bcaa4c32d74d36cd9f7a99b3187",
	"task.json":                              "b410012e8b457a1f20da4099c29e10e057608b86b642c3dcdba00ccb1e6c00a6",
	"verification-budget-failure.json":       "d8144dea88b375e697b2bb1bb46892590cc15949e0286e1094f8b16afbbed715",
}

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
	if len(paths) != sharedFixtureCount || len(sharedFixtureSHA256) != sharedFixtureCount {
		t.Fatalf("shared fixture count = %d and parity table count = %d, want exactly %d", len(paths), len(sharedFixtureSHA256), sharedFixtureCount)
	}

	versionPlaceholders := 0
	observedTools := make(map[string]struct{}, len(coremcpToolNames()))
	var aggregateManifest strings.Builder
	for _, path := range paths {
		path := path
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read fixture %s: %v", path, err)
		}
		name := filepath.Base(path)
		fixtureDigest := sha256Hex(contents)
		if expectedDigest, ok := sharedFixtureSHA256[name]; !ok {
			t.Fatalf("unreviewed shared fixture %q", name)
		} else if fixtureDigest != expectedDigest {
			t.Fatalf("shared fixture %q digest = %s, want fixture-level parity %s", name, fixtureDigest, expectedDigest)
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			t.Fatalf("make fixture path repository-relative: %v", err)
		}
		fmt.Fprintf(&aggregateManifest, "%s  %s\n", fixtureDigest, filepath.ToSlash(relative))

		t.Run(filepath.Base(path), func(t *testing.T) {
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
			observedTools[envelope.Tool] = struct{}{}
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
	toolNames := make([]string, 0, len(observedTools))
	for tool := range observedTools {
		toolNames = append(toolNames, tool)
	}
	slices.Sort(toolNames)
	wantToolNames := slices.Clone(coremcpToolNames())
	slices.Sort(wantToolNames)
	if !slices.Equal(toolNames, wantToolNames) {
		t.Fatalf("fixture tool surface = %v, want exact six-tool surface %v", toolNames, wantToolNames)
	}
	aggregateDigest := sha256Hex([]byte(aggregateManifest.String()))
	if aggregateDigest != sharedFixtureAggregateSHA256 {
		t.Fatalf("canonical shared fixture aggregate digest = %s, want %s", aggregateDigest, sharedFixtureAggregateSHA256)
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
	if tool == "dev_flow_server_info" {
		var tools []string
		if err := json.Unmarshal(result["tools"], &tools); err != nil {
			t.Fatalf("decode server-info tool catalog: %v", err)
		}
		if !slices.Equal(tools, coremcpToolNames()) {
			t.Fatalf("server-info tool catalog = %v, want exact ordered catalog %v", tools, coremcpToolNames())
		}
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
	exactDigests := make(map[string]struct{}, len(fixturePaths))
	canonicalDigests := make(map[string]struct{}, len(fixturePaths))
	for _, path := range fixturePaths {
		names[filepath.Base(path)] = struct{}{}
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read shared fixture %s for copy detection: %v", path, err)
		}
		exactDigests[sha256Hex(contents)] = struct{}{}
		if digest, ok := canonicalJSONSHA256(contents); ok {
			canonicalDigests[digest] = struct{}{}
		}
	}
	for _, host := range []string{"codex", "deepseek"} {
		hostRoot := filepath.Join(root, "packages", host)
		err := filepath.WalkDir(hostRoot, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.Name() == "node_modules" {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if entry.IsDir() && entry.Name() == "fixtures" {
				relative, err := filepath.Rel(hostRoot, path)
				if err != nil {
					return err
				}
				if filepath.ToSlash(relative) != "tests/fixtures" {
					return fmt.Errorf("host package %s owns fixtures outside tests/fixtures: %s", host, filepath.ToSlash(relative))
				}
			}
			if !entry.IsDir() {
				if _, copied := names[entry.Name()]; copied {
					return fmt.Errorf("host package %s copies shared fixture %s", host, entry.Name())
				}
				contents, err := os.ReadFile(path)
				if err != nil {
					return err
				}
				if _, copied := exactDigests[sha256Hex(contents)]; copied {
					return fmt.Errorf("host package %s copies shared fixture content at %s", host, path)
				}
				if digest, ok := canonicalJSONSHA256(contents); ok {
					if _, copied := canonicalDigests[digest]; copied {
						return fmt.Errorf("host package %s copies canonical shared fixture content at %s", host, path)
					}
				}
			}
			return nil
		})
		if err != nil {
			t.Error(err)
		}
	}
}

func sha256Hex(contents []byte) string {
	return fmt.Sprintf("%x", sha256.Sum256(contents))
}

func canonicalJSONSHA256(contents []byte) (string, bool) {
	var value any
	if err := json.Unmarshal(contents, &value); err != nil {
		return "", false
	}
	canonical, err := json.Marshal(value)
	if err != nil {
		return "", false
	}
	return sha256Hex(canonical), true
}

func coremcpToolNames() []string {
	return []string{
		"dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task",
		"dev_flow_get_next_action", "dev_flow_apply_action", "dev_flow_cancel_task",
	}
}
