package application

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/experienceexport"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func experienceTestService(t *testing.T) (*Service, *store.SQLite) {
	t.Helper()
	db, err := store.Open(context.Background(), filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	_, _, observer := phase5Service(t)
	s, err := NewService(db, observer)
	if err != nil {
		t.Fatal(err)
	}
	return s, db
}
func saveTestExperience(t *testing.T, s *Service, task domain.ProcessTask) domain.Experience {
	t.Helper()
	e, err := s.SaveExperience(context.Background(), task.OriginHost, store.ExperienceMutation{TaskID: task.TaskID, ExperienceID: "experience", RequestID: "experience-save", Content: &domain.ExperienceContent{Title: "Independent notes", Problem: "An Action used task revision", Cause: "Auxiliary data shared the snapshot", Resolution: "Keep independent data", Basis: "The saved Action compares Task revision", Applicability: "Auxiliary records", NextChecks: "Inspect Action snapshot inputs", Status: "supported", RepositoryKeys: []domain.RepositoryKey{task.EffectivePrimaryRepositoryKey()}, References: []domain.ExperienceReference{{Kind: "discussion", Locator: "Task discussion", Summary: "Identified revision responsibility"}}}, ChangeReason: "Record existing reasoning"})
	if err != nil {
		t.Fatal(err)
	}
	return e
}
func TestExperienceWriteKeepsIssuedActionAndSharedReads(t *testing.T) {
	s, db := experienceTestService(t)
	task := openPhase5Task(t, s)
	before, _ := json.Marshal(task)
	saveTestExperience(t, s, task)
	saved, err := db.LoadTask(context.Background(), task.TaskID)
	after, _ := json.Marshal(saved)
	if err != nil || string(before) != string(after) {
		t.Fatal("Task changed")
	}
	for _, host := range []domain.Host{domain.HostCodex, domain.HostDeepSeek} {
		d, err := s.GetExperiences(context.Background(), host, task.TaskID, "", 1)
		if err != nil || len(d.Experiences) != 1 {
			t.Fatalf("host read=%+v %v", d, err)
		}
	}
	c := &ControlCenter{core: s, tasks: db}
	d, err := c.GetExperiences(context.Background(), task.TaskID, "", 1)
	if err != nil || len(d.Experiences) != 1 {
		t.Fatal("WebUI data differs")
	}
	result, err := s.SubmitAction(context.Background(), requirementsSubmission(t, task, "requirements-after-experience"))
	if err != nil || result.Task.CurrentNode != domain.NodeDesign {
		t.Fatalf("original Action failed: %v", err)
	}
}

func TestComprehensionExperienceReviewRequiresMethodAndUserVerdict(t *testing.T) {
	for _, withExperience := range []bool{false, true} {
		t.Run(map[bool]string{false: "empty review", true: "saved experience"}[withExperience], func(t *testing.T) {
			s, db := experienceTestService(t)
			task := phase5TaskAtComprehension(t, s)
			if task.CurrentAction.SemanticMethodSteps[0].StepID != "comprehension.collect_experiences" {
				t.Fatal("experience review must precede explanation")
			}
			if withExperience {
				experience := saveTestExperience(t, s, task)
				if experience.Stage != domain.NodeComprehensionReview {
					t.Fatal("experience did not retain the collection stage")
				}
			}
			assertExperienceTaskUnchanged(t, db, task)
			result := comprehensionNodeResult([]string{"Independent experience storage"}, nil, nil, "user", "passed", nil)
			result["problem_class"] = "none"
			request := actionSubmission(t, task, "missing-experience-review", "comprehension_passed", result)
			delete(request.MethodResults, "comprehension.collect_experiences")
			if _, err := s.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrInvalidArgument) {
				t.Fatalf("missing review result was accepted: %v", err)
			}
			assertExperienceTaskUnchanged(t, db, task)
			result["user_confirmation"] = nil
			request = actionSubmission(t, task, "missing-user-verdict", "comprehension_passed", result)
			if _, err := s.SubmitAction(context.Background(), request); !errors.Is(err, domain.ErrTransitionNotAllowed) {
				t.Fatalf("experience substituted for user confirmation: %v", err)
			}
			assertExperienceTaskUnchanged(t, db, task)
			result["user_confirmation"] = map[string]any{"source": "user", "status": "passed", "summary": "Fixture user confirmed the explanation."}
			request = actionSubmission(t, task, "review-and-user-verdict", "comprehension_passed", result)
			summary := "Reviewed the existing work; nothing useful to save."
			if withExperience {
				summary = "Reviewed existing work and saved experience revision 1 before explaining it."
			}
			request.MethodResults["comprehension.collect_experiences"] = MethodResultSubmission{Summary: summary}
			passed, err := s.SubmitAction(context.Background(), request)
			if err != nil || passed.Task.CurrentNode != domain.NodeDelivery {
				t.Fatalf("review and explicit user verdict failed: %v", err)
			}
		})
	}
}

func TestComprehensionExperienceReentryRevisesRecordAndRetainsUserNote(t *testing.T) {
	ctx := context.Background()
	s, db := experienceTestService(t)
	task := phase5TaskAtComprehension(t, s)
	experience := saveTestExperience(t, s, task)
	note := "Check which revision the Action uses before adding auxiliary records."
	experience, err := s.SaveExperience(ctx, task.OriginHost, store.ExperienceMutation{TaskID: task.TaskID, ExperienceID: experience.ExperienceID, RequestID: "review-user-note", ExpectedRevision: experience.Revision, UserNote: note})
	if err != nil {
		t.Fatal(err)
	}
	assertExperienceTaskUnchanged(t, db, task)
	firstAction := task.CurrentAction.ActionID
	task = applyPhase5(t, s, task, "implementation_defect", "The current implementation needs correction.", comprehensionNodeResult(nil, nil, nil, "", "", []string{"Correct the identified implementation defect."}))
	task = applyPhase5(t, s, task, "implementation_ready_for_test", "", implementationNodeResult(task.TaskPlan.Revision, []string{"work-a"}, true, nil))
	task = applyPhase5(t, s, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "reentry-check", 1, false)}, nil, nil, nil))
	if task.CurrentAction.ActionID == firstAction || task.CurrentAction.SemanticMethodSteps[0].StepID != "comprehension.collect_experiences" {
		t.Fatal("reentry did not issue a fresh review obligation")
	}
	current, err := s.GetExperiences(ctx, task.OriginHost, task.TaskID, "", 1)
	if err != nil || len(current.Experiences) != 1 || current.Experiences[0].Revision != experience.Revision {
		t.Fatalf("existing experience unavailable on reentry: %+v %v", current, err)
	}
	content := current.Experiences[0].Content
	content.Basis = "The corrected implementation and its current targeted check support separate revisions."
	request := store.ExperienceMutation{TaskID: task.TaskID, ExperienceID: experience.ExperienceID, RequestID: "review-revised-conclusion", ExpectedRevision: experience.Revision, Content: &content, ChangeReason: "Revise the same finding after implementation and verification."}
	revised, err := s.SaveExperience(ctx, task.OriginHost, request)
	if err != nil {
		t.Fatal(err)
	}
	retried, err := s.SaveExperience(ctx, task.OriginHost, request)
	if err != nil || !reflect.DeepEqual(revised, retried) {
		t.Fatalf("identical save retry changed the revision: %v", err)
	}
	current, err = s.GetExperiences(ctx, task.OriginHost, task.TaskID, "", 1)
	if err != nil || len(current.Experiences) != 1 || revised.Revision != 3 || len(revised.UserNotes) != 1 || revised.UserNotes[0].Text != note || revised.UpdatedStage != domain.NodeComprehensionReview {
		t.Fatalf("reentry duplicated experience or lost the user supplement: %+v %v", current, err)
	}
	history, err := s.GetExperiences(ctx, task.OriginHost, task.TaskID, experience.ExperienceID, 1)
	if err != nil || len(history.Experiences) != 3 {
		t.Fatalf("revision history lost: %+v %v", history, err)
	}
	assertExperienceTaskUnchanged(t, db, task)
}

type failingExperienceStore struct{ *store.SQLite }

func (s failingExperienceStore) SaveExperience(context.Context, domain.Host, store.ExperienceMutation, time.Time) (domain.Experience, error) {
	return domain.Experience{}, store.ErrStorageUnavailable
}

func TestComprehensionExperienceSaveFailureKeepsActionAndSavedContent(t *testing.T) {
	s, db := experienceTestService(t)
	task := phase5TaskAtComprehension(t, s)
	experience := saveTestExperience(t, s, task)
	s.taskStore = failingExperienceStore{db}
	content := experience.Content
	content.Basis = "A new finding that could not be saved."
	_, err := s.SaveExperience(context.Background(), task.OriginHost, store.ExperienceMutation{TaskID: task.TaskID, ExperienceID: experience.ExperienceID, RequestID: "failed-review-save", ExpectedRevision: experience.Revision, Content: &content, ChangeReason: "Update after discussion."})
	if !errors.Is(err, domain.ErrStorageUnavailable) {
		t.Fatalf("save failure was hidden: %v", err)
	}
	current, err := s.GetExperiences(context.Background(), task.OriginHost, task.TaskID, "", 1)
	if err != nil || len(current.Experiences) != 1 || !reflect.DeepEqual(current.Experiences[0], experience) {
		t.Fatalf("failed save lost or changed the existing record: %+v %v", current, err)
	}
	assertExperienceTaskUnchanged(t, db, task)
}

func assertExperienceTaskUnchanged(t *testing.T, db *store.SQLite, task domain.ProcessTask) {
	t.Helper()
	saved, err := db.LoadTask(context.Background(), task.TaskID)
	if err != nil || !reflect.DeepEqual(saved, task) {
		t.Fatalf("experience operation changed the Task or issued Action: %v", err)
	}
}

type failingExperienceWriter struct{}

func (failingExperienceWriter) Write(string, string, []byte, []string) (string, error) {
	return "", errors.New("disk unavailable")
}
func TestDoneExperienceExportFailureRecoveryAndStableMarkdown(t *testing.T) {
	s, db := experienceTestService(t)
	task := phase5TaskAtDelivery(t, s)
	saveTestExperience(t, s, task)
	s.SetExperienceExporter(failingExperienceWriter{})
	request := actionSubmission(t, task, "delivery-experience", "delivery_complete", deliverySubmissionResult(task))
	result, err := s.SubmitAction(context.Background(), request)
	if err != nil || result.Task.CurrentNode != domain.NodeDone {
		t.Fatalf("delivery=%s %v", result.Task.CurrentNode, err)
	}
	state, err := db.ReadExperienceExport(context.Background(), task.TaskID)
	if err != nil || state.Error == "" || state.Generation == state.ExportedGeneration {
		t.Fatalf("export failure=%+v %v", state, err)
	}
	s.SetExperienceExporter(experienceexport.Writer{Directory: t.TempDir()})
	recovered, err := s.RecoverAction(context.Background(), RecoverActionRequest{Host: task.OriginHost, TaskID: task.TaskID, ActionID: task.CurrentAction.ActionID})
	if err != nil || recovered.Task.Revision != result.Task.Revision {
		t.Fatal("retry changed completion")
	}
	state, _ = db.ReadExperienceExport(context.Background(), task.TaskID)
	first, err := os.ReadFile(state.Path)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.ExportExperiences(context.Background(), domain.HostDeepSeek, task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	second, _ := os.ReadFile(again.Path)
	if string(first) != string(second) {
		t.Fatal("repeated snapshot differs")
	}
	if err = db.Close(); err != nil {
		t.Fatal(err)
	}
}
