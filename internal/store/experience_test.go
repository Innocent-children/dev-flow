package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"testing"
	"time"
)

func experienceContent() *domain.ExperienceContent {
	return &domain.ExperienceContent{Title: "Preserve independent records", Problem: "Recording notes invalidated an Action", Cause: "Notes shared Task revision", Resolution: "Keep separate revisions", Basis: "Task snapshot comparison rejected a changed revision", Applicability: "Auxiliary task data", NextChecks: "Check which revision the Action uses", Status: "supported", RepositoryKeys: []domain.RepositoryKey{"primary"}, References: []domain.ExperienceReference{{Kind: "discussion", Locator: "Task discussion", Summary: "Existing Action snapshot was compared"}}}
}
func TestExperienceReopenRevisionNotesIdempotencyAndSnapshot(t *testing.T) {
	ctx := context.Background()
	path := dbPath(t)
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	task := testGraphTask(t)
	if err = db.CommitTask(ctx, testMutation(t, task)); err != nil {
		t.Fatal(err)
	}
	task, err = db.LoadTask(ctx, task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	before, _ := json.Marshal(task)
	m := ExperienceMutation{TaskID: task.TaskID, ExperienceID: "experience-one", RequestID: "request-experience-one", Content: experienceContent(), ChangeReason: "Initial supported finding"}
	m.Content.RepositoryKeys = []domain.RepositoryKey{task.EffectivePrimaryRepositoryKey()}
	first, err := db.SaveExperience(ctx, task.OriginHost, m, task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	retry, err := db.SaveExperience(ctx, task.OriginHost, m, task.UpdatedAt.Add(time.Second))
	if err != nil || retry.Revision != 1 || !retry.UpdatedAt.Equal(first.UpdatedAt) {
		t.Fatalf("retry=%+v %v", retry, err)
	}
	m.ChangeReason = "Conflicting request"
	if _, err = db.SaveExperience(ctx, task.OriginHost, m, task.UpdatedAt); err == nil {
		t.Fatal("conflicting id accepted")
	}
	note := ExperienceMutation{TaskID: task.TaskID, ExperienceID: first.ExperienceID, RequestID: "note-one", ExpectedRevision: 1, UserNote: "I should inspect the snapshot before changing revision handling."}
	if _, err = db.SaveExperience(ctx, task.OriginHost, note, task.UpdatedAt.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	m.RequestID = "revision-three"
	m.ExpectedRevision = 2
	m.Content.Status = "refuted"
	m.Content.Basis = "The later check disproved the initial explanation; the original snapshot comparison remains useful context."
	if _, err = db.SaveExperience(ctx, task.OriginHost, m, task.UpdatedAt.Add(2*time.Second)); err != nil {
		t.Fatal(err)
	}
	m.RequestID = "stale"
	if _, err = db.SaveExperience(ctx, task.OriginHost, m, task.UpdatedAt.Add(3*time.Second)); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("stale=%v", err)
	}
	saved, err := db.LoadTask(ctx, task.TaskID)
	after, _ := json.Marshal(saved)
	if err != nil || string(before) != string(after) {
		t.Fatal("experience modified Task snapshot")
	}
	db.Close()
	db, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	history, err := db.ReadExperiences(ctx, task.TaskID, first.ExperienceID)
	if err != nil || len(history) != 3 || history[0].Content.Status != "supported" || history[2].Content.Status != "refuted" || len(history[2].UserNotes) != 1 {
		t.Fatalf("history=%+v err=%v", history, err)
	}
	page, err := db.SearchExperiences(ctx, ExperienceQuery{Text: "inspect the snapshot", Project: string(task.WorkspaceOrigin.SourceRepositoryGroupDigest)})
	if err != nil || len(page.Items) != 1 {
		t.Fatalf("search=%+v %v", page, err)
	}
}
func TestExperienceExportFailureAndRetryStableGeneration(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, dbPath(t))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	task := testGraphTask(t)
	if err = db.CommitTask(ctx, testMutation(t, task)); err != nil {
		t.Fatal(err)
	}
	content := experienceContent()
	content.RepositoryKeys = []domain.RepositoryKey{task.EffectivePrimaryRepositoryKey()}
	_, err = db.SaveExperience(ctx, task.OriginHost, ExperienceMutation{TaskID: task.TaskID, ExperienceID: "experience", RequestID: "save", Content: content, ChangeReason: "Record"}, task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	failed, err := db.ExportExperiences(ctx, task.TaskID, func(ExperienceSnapshot) (string, error) { return "", errors.New("disk full") })
	if err != nil || failed.Error == "" || failed.ExportedGeneration != 0 {
		t.Fatalf("failure=%+v %v", failed, err)
	}
	good, err := db.ExportExperiences(ctx, task.TaskID, func(s ExperienceSnapshot) (string, error) {
		if len(s.Experiences) != 1 || s.Task.Revision != task.Revision {
			t.Fatal("wrong snapshot")
		}
		return "/saved/experience.md", nil
	})
	if err != nil || good.ExportedGeneration != good.Generation || good.Error != "" {
		t.Fatalf("retry=%+v %v", good, err)
	}
	again, err := db.ExportExperiences(ctx, task.TaskID, func(ExperienceSnapshot) (string, error) { return "/saved/experience.md", nil })
	if err != nil || good != again {
		t.Fatal("repeat changed generation")
	}
}

func TestExperienceCorruptHistoryIsRejectedOnReopen(t *testing.T) {
	ctx := context.Background()
	path := dbPath(t)
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	task := testGraphTask(t)
	if err = db.CommitTask(ctx, testMutation(t, task)); err != nil {
		t.Fatal(err)
	}
	_, err = db.SaveExperience(ctx, task.OriginHost, ExperienceMutation{TaskID: task.TaskID, ExperienceID: "experience", RequestID: "save", Content: experienceContent(), ChangeReason: "Initial finding"}, task.UpdatedAt)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.db.Exec(`UPDATE experience_revisions SET record=json_set(record,'$.revision',2)`); err != nil {
		t.Fatal(err)
	}
	db.Close()
	if opened, err := Open(ctx, path); err == nil {
		opened.Close()
		t.Fatal("corrupt experience accepted")
	}
}
