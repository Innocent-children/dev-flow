package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type ExperienceMutation struct {
	TaskID           domain.ID                 `json:"task_id"`
	ExperienceID     domain.ID                 `json:"experience_id"`
	RequestID        domain.ID                 `json:"request_id"`
	ExpectedRevision uint64                    `json:"expected_revision"`
	Content          *domain.ExperienceContent `json:"content"`
	ChangeReason     string                    `json:"change_reason"`
	UserNote         string                    `json:"user_note"`
}
type ExperienceQuery struct {
	TaskID        domain.ID
	Project, Text string
	Page          int
}
type ExperienceMatch struct {
	Experience  domain.Experience `json:"experience"`
	TaskSummary string            `json:"task_summary"`
	TaskState   domain.NodeID     `json:"task_state"`
	Archived    bool              `json:"archived"`
}
type ExperiencePage struct {
	Items   []ExperienceMatch `json:"items"`
	Page    int               `json:"page"`
	HasNext bool              `json:"has_next"`
}
type ExperienceExport struct {
	TaskID             domain.ID `json:"task_id"`
	Generation         uint64    `json:"generation"`
	ExportedGeneration uint64    `json:"exported_generation"`
	Path               string    `json:"path"`
	Error              string    `json:"error"`
}
type ExperienceSnapshot struct {
	Task        domain.ProcessTask
	Experiences []domain.Experience
	Export      ExperienceExport
}
type ExperienceStore interface {
	SaveExperience(context.Context, domain.Host, ExperienceMutation, time.Time) (domain.Experience, error)
	ReadExperiences(context.Context, domain.ID, domain.ID) ([]domain.Experience, error)
	SearchExperiences(context.Context, ExperienceQuery) (ExperiencePage, error)
	ReadExperienceExport(context.Context, domain.ID) (ExperienceExport, error)
	ExportExperiences(context.Context, domain.ID, func(ExperienceSnapshot) (string, error)) (ExperienceExport, error)
}

func validateExperienceMutation(m ExperienceMutation) error {
	if !m.TaskID.IsValid() || !m.ExperienceID.IsValid() || !m.RequestID.IsValid() {
		return domain.ErrInvalidArgument
	}
	if m.Content != nil {
		if m.UserNote != "" {
			return domain.InvalidArgumentViolations(domain.Violation("user_note", domain.RuleCollectionMustBeEmpty))
		}
		if err := m.Content.Validate(); err != nil {
			return err
		}
		return domain.ValidateExperienceText("change_reason", m.ChangeReason)
	}
	if m.ExpectedRevision == 0 || m.ChangeReason != "" {
		return domain.ErrInvalidArgument
	}
	return domain.ValidateExperienceText("user_note", m.UserNote)
}
func (s *SQLite) SaveExperience(ctx context.Context, host domain.Host, m ExperienceMutation, now time.Time) (domain.Experience, error) {
	if s == nil || s.db == nil || ctx == nil || !host.IsValid() || now.IsZero() || now.Location() != time.UTC {
		return domain.Experience{}, ErrInvalidArgument
	}
	if err := validateExperienceMutation(m); err != nil {
		return domain.Experience{}, err
	}
	raw, _ := json.Marshal(m)
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Experience{}, ErrStorageUnavailable
	}
	defer tx.Rollback()
	item, err := loadControlCenterTaskRow(ctx, tx, m.TaskID)
	if err != nil {
		return domain.Experience{}, err
	}
	task := item.Task
	if task.OriginHost != host {
		return domain.Experience{}, domain.ErrHostOwnershipConflict
	}
	var savedDigest string
	var saved []byte
	err = tx.QueryRowContext(ctx, `SELECT request_digest,record FROM experience_revisions WHERE task_id=? AND request_id=?`, m.TaskID, m.RequestID).Scan(&savedDigest, &saved)
	if err == nil {
		if savedDigest != digest {
			return domain.Experience{}, domain.InvalidArgumentViolations(domain.Violation("request_id", domain.RuleCurrentValueRequired))
		}
		return decodeExperience(saved)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return domain.Experience{}, ErrStorageUnavailable
	}
	var current domain.Experience
	err = tx.QueryRowContext(ctx, `SELECT record FROM experience_revisions WHERE task_id=? AND experience_id=? ORDER BY revision DESC LIMIT 1`, m.TaskID, m.ExperienceID).Scan(&saved)
	if err == nil {
		current, err = decodeExperience(saved)
		if err != nil {
			return domain.Experience{}, err
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Experience{}, ErrStorageUnavailable
	}
	if current.Revision != m.ExpectedRevision {
		return domain.Experience{}, ErrRevisionConflict
	}
	next := current
	if current.Revision == 0 {
		next = domain.Experience{TaskID: m.TaskID, ExperienceID: m.ExperienceID, CreatedAt: now, UserNotes: []domain.ExperienceNote{}}
	}
	next.Revision++
	next.UpdatedAt = now
	next.UpdatedStage = task.CurrentNode
	if current.Revision == 0 {
		next.Stage = task.CurrentNode
	}
	digests, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		return domain.Experience{}, ErrStorageUnavailable
	}
	next.ContentDigest = digests.Content
	if m.Content != nil {
		next.Content = *m.Content
		next.ChangeReason = m.ChangeReason
	} else {
		next.ChangeReason = "User supplement"
		next.UserNotes = append(next.UserNotes, domain.ExperienceNote{Text: m.UserNote, CreatedAt: now})
	}
	next.Projects = []domain.ExperienceProject{}
	for _, key := range next.Content.RepositoryKeys {
		if key == task.EffectivePrimaryRepositoryKey() {
			next.Projects = append(next.Projects, domain.ExperienceProject{Key: key, Group: task.WorkspaceOrigin.SourceRepositoryGroupDigest, Path: task.WorkspaceOrigin.CanonicalWorktreeRoot})
			continue
		}
		found := false
		for _, r := range task.AdditionalRepositories {
			if r.Key == key {
				next.Projects = append(next.Projects, domain.ExperienceProject{Key: key, Group: r.Origin.SourceRepositoryGroupDigest, Path: r.Origin.CanonicalWorktreeRoot})
				found = true
				break
			}
		}
		if !found {
			return domain.Experience{}, domain.InvalidArgumentViolations(domain.Violation("content.repository_keys", domain.RuleKnownIdentifierRequired))
		}
	}
	if err := next.Validate(); err != nil {
		return domain.Experience{}, err
	}
	raw, err = json.Marshal(next)
	if err != nil {
		return domain.Experience{}, ErrInvalidArgument
	}
	if len(raw) > 65536 {
		field := "content"
		if m.Content == nil {
			field = "user_note"
		}
		failure := domain.InvalidArgumentViolations(domain.Violation(field, domain.RuleExperienceSize))
		failure.Budget = &domain.BudgetFailure{Used: 0, Requested: len(raw), Limit: 65536}
		return domain.Experience{}, failure
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO experience_revisions(task_id,experience_id,revision,request_id,request_digest,record) VALUES(?,?,?,?,?,?)`, m.TaskID, m.ExperienceID, next.Revision, m.RequestID, digest, raw); err != nil {
		return domain.Experience{}, ErrStorageUnavailable
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO experience_exports(task_id,generation,exported_generation,path,error) VALUES(?,1,0,'','') ON CONFLICT(task_id) DO UPDATE SET generation=generation+1,error=''`, m.TaskID); err != nil {
		return domain.Experience{}, ErrStorageUnavailable
	}
	if tx.Commit() != nil {
		return domain.Experience{}, ErrStorageUnavailable
	}
	return next, nil
}
func decodeExperience(raw []byte) (domain.Experience, error) {
	var e domain.Experience
	if len(raw) > 65536 || !utf8.Valid(raw) || rejectDuplicateJSON(raw) != nil {
		return e, ErrStorageUnavailable
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(&e) != nil || e.Validate() != nil {
		return e, ErrStorageUnavailable
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return e, ErrStorageUnavailable
	}
	return e, nil
}

// An empty experience ID returns current records; a concrete ID returns its ordered history.
func readExperiences(ctx context.Context, q queryer, taskID, experienceID domain.ID) ([]domain.Experience, error) {
	query := `SELECT record FROM experience_revisions e WHERE task_id=?`
	args := []any{taskID}
	if experienceID != "" {
		query += ` AND experience_id=? ORDER BY revision`
		args = append(args, experienceID)
	} else {
		query += ` AND revision=(SELECT MAX(revision) FROM experience_revisions WHERE task_id=e.task_id AND experience_id=e.experience_id) ORDER BY experience_id`
	}
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, ErrStorageUnavailable
	}
	defer rows.Close()
	items := []domain.Experience{}
	for rows.Next() {
		var raw []byte
		if rows.Scan(&raw) != nil {
			return nil, ErrStorageUnavailable
		}
		e, err := decodeExperience(raw)
		if err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	if rows.Err() != nil {
		return nil, ErrStorageUnavailable
	}
	return items, nil
}
func (s *SQLite) ReadExperiences(ctx context.Context, t, id domain.ID) ([]domain.Experience, error) {
	return readExperiences(ctx, s.db, t, id)
}
func (s *SQLite) SearchExperiences(ctx context.Context, q ExperienceQuery) (ExperiencePage, error) {
	result := ExperiencePage{Items: []ExperienceMatch{}, Page: q.Page}
	if result.Page == 0 {
		result.Page = 1
	}
	if result.Page < 1 || result.Page > 1000000 || len(q.Text) > 512 || len(q.Project) > 4096 || !utf8.ValidString(q.Text) || !utf8.ValidString(q.Project) || q.TaskID != "" && !q.TaskID.IsValid() {
		return result, ErrInvalidArgument
	}
	query := `SELECT e.record,t.snapshot,t.archived_at FROM experience_revisions e JOIN tasks t ON t.task_id=e.task_id WHERE e.revision=(SELECT MAX(revision) FROM experience_revisions WHERE task_id=e.task_id AND experience_id=e.experience_id)`
	args := []any{}
	if q.TaskID != "" {
		query += ` AND e.task_id=?`
		args = append(args, q.TaskID)
	}
	query += ` ORDER BY t.updated_at DESC,e.task_id,e.experience_id`
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return result, ErrStorageUnavailable
	}
	defer rows.Close()
	matched := 0
	for rows.Next() {
		var raw, snapshot []byte
		var archived sql.NullString
		if rows.Scan(&raw, &snapshot, &archived) != nil {
			return result, ErrStorageUnavailable
		}
		e, err := decodeExperience(raw)
		if err != nil {
			return result, err
		}
		task, err := decodeTask(snapshot)
		if err != nil {
			return result, err
		}
		projectOK := q.Project == ""
		for _, p := range e.Projects {
			if string(p.Group) == q.Project || p.Path == q.Project {
				projectOK = true
			}
		}
		if !projectOK || !strings.Contains(strings.ToLower(string(raw)+" "+task.Intent.Request), strings.ToLower(q.Text)) {
			continue
		}
		matched++
		if matched <= (result.Page-1)*5 {
			continue
		}
		if len(result.Items) == 5 {
			result.HasNext = true
			break
		}
		result.Items = append(result.Items, ExperienceMatch{Experience: e, TaskSummary: task.Intent.Request, TaskState: task.CurrentNode, Archived: archived.Valid})
	}
	if rows.Err() != nil {
		return result, ErrStorageUnavailable
	}
	return result, nil
}
func readExperienceExport(ctx context.Context, q queryer, id domain.ID) (ExperienceExport, error) {
	e := ExperienceExport{TaskID: id}
	err := q.QueryRowContext(ctx, `SELECT generation,exported_generation,path,error FROM experience_exports WHERE task_id=?`, id).Scan(&e.Generation, &e.ExportedGeneration, &e.Path, &e.Error)
	if errors.Is(err, sql.ErrNoRows) {
		return e, nil
	}
	if err != nil {
		return e, ErrStorageUnavailable
	}
	return e, nil
}
func (s *SQLite) ReadExperienceExport(ctx context.Context, id domain.ID) (ExperienceExport, error) {
	return readExperienceExport(ctx, s.db, id)
}

// Serialize snapshot selection and replacement with writers, so an older export cannot replace a newer one.
func (s *SQLite) ExportExperiences(ctx context.Context, id domain.ID, write func(ExperienceSnapshot) (string, error)) (ExperienceExport, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ExperienceExport{}, ErrStorageUnavailable
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE experience_exports SET generation=generation WHERE task_id=?`, id); err != nil {
		return ExperienceExport{}, ErrStorageUnavailable
	}
	item, err := loadControlCenterTaskRow(ctx, tx, id)
	if err != nil {
		return ExperienceExport{}, err
	}
	state, err := readExperienceExport(ctx, tx, id)
	if err != nil {
		return state, err
	}
	records, err := readExperiences(ctx, tx, id, "")
	if err != nil {
		return state, err
	}
	if len(records) == 0 {
		return state, nil
	}
	path, writeErr := write(ExperienceSnapshot{Task: item.Task, Experiences: records, Export: state})
	if writeErr != nil {
		state.Error = "Could not export experiences. Saved data is intact; retry export."
	} else {
		state.Path = path
		state.Error = ""
		state.ExportedGeneration = state.Generation
	}
	if _, err = tx.ExecContext(ctx, `UPDATE experience_exports SET exported_generation=?,path=?,error=? WHERE task_id=?`, state.ExportedGeneration, state.Path, state.Error, id); err != nil {
		return state, ErrStorageUnavailable
	}
	if tx.Commit() != nil {
		return state, ErrStorageUnavailable
	}
	return state, nil
}
func preflightExperiences(ctx context.Context, db *sql.DB, tasks map[string]preflightTask) error {
	rows, err := db.QueryContext(ctx, `SELECT task_id,experience_id,revision,request_id,request_digest,record FROM experience_revisions ORDER BY task_id,experience_id,revision`)
	if err != nil {
		return ErrStorageUnavailable
	}
	defer rows.Close()
	previous := map[string]domain.Experience{}
	taskCounts := map[string]int{}
	for rows.Next() {
		var taskID, expID, requestID, digest string
		var rev uint64
		var raw []byte
		if rows.Scan(&taskID, &expID, &rev, &requestID, &digest, &raw) != nil {
			return ErrStorageUnavailable
		}
		e, err := decodeExperience(raw)
		_, found := tasks[taskID]
		if err != nil || !found || string(e.TaskID) != taskID || string(e.ExperienceID) != expID || e.Revision != rev || !domain.ID(requestID).IsValid() || !domain.Digest(digest).IsValid() {
			return ErrStorageUnavailable
		}
		for _, project := range e.Projects {
			expected := tasks[taskID].task
			group := domain.Digest("")
			if project.Key == expected.EffectivePrimaryRepositoryKey() {
				group = expected.WorkspaceOrigin.SourceRepositoryGroupDigest
			}
			for _, repository := range expected.AdditionalRepositories {
				if repository.Key == project.Key {
					group = repository.Origin.SourceRepositoryGroupDigest
				}
			}
			if group != project.Group {
				return ErrStorageUnavailable
			}
		}
		key := taskID + "/" + expID
		old := previous[key]
		if e.Revision != old.Revision+1 {
			return ErrStorageUnavailable
		}
		if old.Revision > 0 {
			if !old.CreatedAt.Equal(e.CreatedAt) || old.Stage != e.Stage || e.UpdatedAt.Before(old.UpdatedAt) || len(e.UserNotes) < len(old.UserNotes) {
				return ErrStorageUnavailable
			}
			for i, n := range old.UserNotes {
				if n != e.UserNotes[i] {
					return ErrStorageUnavailable
				}
			}
		}
		previous[key] = e
		taskCounts[taskID]++
	}
	if rows.Err() != nil || rows.Close() != nil {
		return ErrStorageUnavailable
	}
	rows, err = db.QueryContext(ctx, `SELECT task_id,generation,exported_generation,path,error FROM experience_exports`)
	if err != nil {
		return ErrStorageUnavailable
	}
	defer rows.Close()
	for rows.Next() {
		var e ExperienceExport
		if rows.Scan(&e.TaskID, &e.Generation, &e.ExportedGeneration, &e.Path, &e.Error) != nil || taskCounts[string(e.TaskID)] == 0 || e.Generation < uint64(taskCounts[string(e.TaskID)]) || e.ExportedGeneration > e.Generation || e.ExportedGeneration > 0 && e.Path == "" {
			return ErrStorageUnavailable
		}
		delete(taskCounts, string(e.TaskID))
	}
	if rows.Err() != nil || len(taskCounts) > 0 {
		return ErrStorageUnavailable
	}
	return nil
}
