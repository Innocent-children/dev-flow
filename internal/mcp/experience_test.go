package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/experienceexport"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/webui"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestExperienceMCPWebUIShareSupplementsArchivedSearchAndExport(t *testing.T) {
	ctx := context.Background()
	examples := readSkillExamples(t, "codex")
	s := newSkillScenario(t, "codex", examples)
	s.prepare(s.example("experience_note"))
	task := s.task
	center, err := application.NewControlCenter(s.database, s.observer)
	if err != nil {
		t.Fatal(err)
	}
	center.SetExperienceExporter(experienceexport.Writer{Directory: t.TempDir()})
	handler, err := webui.NewAPI(center, center, func() webui.SystemStatusResponse { return webui.SystemStatusResponse{Readiness: webui.ReadinessReady} })
	if err != nil {
		t.Fatal(err)
	}
	body := `{"request_id":"web-note","expected_revision":1,"user_note":"先检查 Action 依赖的快照，避免记录笔记改变任务。","csrf":"test"}`
	request := httptest.NewRequest(http.MethodPost, "/api/tasks/"+string(task.TaskID)+"/experiences/experience-example/notes", strings.NewReader(body))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatalf("note: %d %s", response.Code, response.Body.String())
	}
	// Both Host reads observe the user supplement written by WebUI.
	for _, host := range []string{"codex", "deepseek"} {
		raw, _ := json.Marshal(map[string]any{"host": host, "task_id": task.TaskID})
		out := s.server.dispatch(ctx, ToolGetExperiences, "experience-read", raw)
		if out.IsError || !bytes.Contains(out.JSON, []byte("先检查")) {
			t.Fatalf("read=%s", out.JSON)
		}
		validateSkillSchema(t, mustSchemaJSON(t, toolOutputSchema(ToolGetExperiences)), out.JSON)
	}
	s.call("cancel")
	task = s.task
	if _, err = s.database.SetTaskArchived(ctx, store.ArchiveTaskMutation{TaskID: task.TaskID, ExpectedRevision: task.Revision, Archived: true, ArchivedAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/experiences?text="+"Action", nil))
	if response.Code != 200 || !strings.Contains(response.Body.String(), `"archived":true`) || !strings.Contains(response.Body.String(), `"task_state":"CANCELLED"`) {
		t.Fatalf("archive search=%s", response.Body.String())
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/tasks/"+string(task.TaskID)+"/experiences/export", strings.NewReader(`{"csrf":"test"}`)))
	if response.Code != 200 {
		t.Fatalf("export=%s", response.Body.String())
	}
	state, err := s.database.ReadExperienceExport(ctx, task.TaskID)
	if err != nil || state.Error != "" {
		t.Fatalf("export state=%+v %v", state, err)
	}
	doc, err := os.ReadFile(state.Path)
	if err != nil || !bytes.Contains(doc, []byte("CANCELLED")) || !bytes.Contains(doc, []byte("先检查")) {
		t.Fatalf("doc=%s %v", doc, err)
	}

	if err = s.database.PurgeTask(ctx, store.PurgeTaskMutation{TaskID: task.TaskID, ExpectedRevision: task.Revision, TypedTaskID: task.TaskID, Reason: "Delete fixture", Irreversible: true}); err != nil {
		t.Fatal(err)
	}
	page, err := s.database.SearchExperiences(ctx, store.ExperienceQuery{})
	if err != nil || len(page.Items) != 0 {
		t.Fatal("purge left experience")
	}
	if _, err = os.Stat(state.Path); err != nil {
		t.Fatal("purge removed export")
	}
}
func TestExperienceRequestsRejectInvalidContentAndKeepTaskRevision(t *testing.T) {
	s := newSkillScenario(t, "codex", readSkillExamples(t, "codex"))
	s.prepare(s.example("experience_record"))
	raw := s.bind(s.example("experience_record"))
	var input map[string]any
	json.Unmarshal(raw, &input)
	input["content"].(map[string]any)["status"] = "guessed"
	bad, _ := json.Marshal(input)
	out := s.server.dispatch(context.Background(), ToolSaveExperience, "bad-experience", bad)
	if !out.IsError {
		t.Fatal("invalid status accepted")
	}
	validateSkillSchema(t, mustSchemaJSON(t, toolOutputSchema(ToolSaveExperience)), out.JSON)
	after, err := s.database.LoadTask(context.Background(), s.task.TaskID)
	if err != nil || after.Revision != s.task.Revision {
		t.Fatal("bad request changed task")
	}
}

func TestExperienceBrowserFixture(t *testing.T) {
	dest := os.Getenv("DEV_FLOW_EXPERIENCE_UI_FIXTURE")
	if dest == "" {
		t.Skip("optional local browser fixture")
	}
	if err := os.MkdirAll(dest, 0700); err != nil {
		t.Fatal(err)
	}
	s := newSkillScenarioAt(t, "codex", readSkillExamples(t, "codex"), filepath.Join(dest, "dev-flow.db"))
	s.prepare(s.example("experience_note"))
	s.call("experience_note")
	s.call("cancel")
	if _, err := s.database.SetTaskArchived(context.Background(), store.ArchiveTaskMutation{TaskID: s.task.TaskID, ExpectedRevision: s.task.Revision, Archived: true, ArchivedAt: time.Now().UTC()}); err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]any{"task_id": s.task.TaskID, "note": "Simulated task for local UI verification"})
	if err := os.WriteFile(filepath.Join(dest, "fixture.json"), raw, 0600); err != nil {
		t.Fatal(err)
	}
}
