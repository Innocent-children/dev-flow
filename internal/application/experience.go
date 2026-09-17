package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

// ExperienceExporter handles local filesystem effects; the application renders saved product data.
type ExperienceExporter interface {
	Write(string, string, []byte, []string) (string, error)
}

func (s *Service) SetExperienceExporter(writer ExperienceExporter) { s.experienceExporter = writer }
func (c *ControlCenter) SetExperienceExporter(writer ExperienceExporter) {
	c.core.SetExperienceExporter(writer)
}

type ExperienceDetail struct {
	Page        int                    `json:"page"`
	HasNext     bool                   `json:"has_next"`
	TaskID      domain.ID              `json:"task_id"`
	TaskState   domain.NodeID          `json:"task_state"`
	Experiences []domain.Experience    `json:"experiences"`
	Export      store.ExperienceExport `json:"export"`
}

func (s *Service) experienceStore() (store.ExperienceStore, error) {
	if s == nil || !s.valid() {
		return nil, domain.ErrInvalidArgument
	}
	v, ok := s.taskStore.(store.ExperienceStore)
	if !ok {
		return nil, domain.ErrStorageUnavailable
	}
	return v, nil
}
func experienceError(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := err.(*domain.Error); ok {
		return err
	}
	return mapStoreError(err)
}
func (s *Service) SaveExperience(ctx context.Context, host domain.Host, m store.ExperienceMutation) (domain.Experience, error) {
	if ctx == nil {
		return domain.Experience{}, domain.ErrInvalidArgument
	}
	st, err := s.experienceStore()
	if err != nil {
		return domain.Experience{}, err
	}
	e, err := st.SaveExperience(ctx, host, m, s.now())
	return e, experienceError(err)
}
func (s *Service) GetExperiences(ctx context.Context, host domain.Host, taskID, experienceID domain.ID, page int) (ExperienceDetail, error) {
	if s == nil || !s.valid() || ctx == nil || page < 0 || page > 1000000 || !host.IsValid() || !taskID.IsValid() || experienceID != "" && !experienceID.IsValid() {
		return ExperienceDetail{}, domain.ErrInvalidArgument
	}
	// Reading historical experience is shared across Hosts; business mutations retain origin ownership.
	task, err := s.taskStore.LoadTask(ctx, taskID)
	if err != nil {
		return ExperienceDetail{}, experienceError(err)
	}
	st, err := s.experienceStore()
	if err != nil {
		return ExperienceDetail{}, err
	}
	records, err := st.ReadExperiences(ctx, taskID, experienceID)
	if err != nil {
		return ExperienceDetail{}, experienceError(err)
	}
	if page == 0 {
		page = 1
	}
	start := (page - 1) * 5
	if start > len(records) {
		start = len(records)
	}
	end := start + 5
	more := end < len(records)
	if end > len(records) {
		end = len(records)
	}
	records = records[start:end]
	state, err := st.ReadExperienceExport(ctx, taskID)
	return ExperienceDetail{Page: page, HasNext: more, TaskID: taskID, TaskState: task.CurrentNode, Experiences: records, Export: state}, experienceError(err)
}
func (s *Service) SearchExperiences(ctx context.Context, q store.ExperienceQuery) (store.ExperiencePage, error) {
	if ctx == nil {
		return store.ExperiencePage{}, domain.ErrInvalidArgument
	}
	st, err := s.experienceStore()
	if err != nil {
		return store.ExperiencePage{}, err
	}
	page, err := st.SearchExperiences(ctx, q)
	return page, experienceError(err)
}
func (s *Service) ExportExperiences(ctx context.Context, host domain.Host, id domain.ID) (store.ExperienceExport, error) {
	if ctx == nil || !host.IsValid() || !id.IsValid() {
		return store.ExperienceExport{}, domain.ErrInvalidArgument
	}
	st, err := s.experienceStore()
	if err != nil {
		return store.ExperienceExport{}, err
	}
	result, err := st.ExportExperiences(ctx, id, func(snapshot store.ExperienceSnapshot) (string, error) {
		if s.experienceExporter == nil {
			return "", fmt.Errorf("export writer is unavailable")
		}
		roots := []string{snapshot.Task.WorkspaceOrigin.CanonicalWorktreeRoot}
		for _, r := range snapshot.Task.AdditionalRepositories {
			roots = append(roots, r.Origin.CanonicalWorktreeRoot)
		}
		return s.experienceExporter.Write(string(snapshot.Task.WorkspaceOrigin.SourceRepositoryGroupDigest), string(id), renderExperiences(snapshot), roots)
	})
	return result, experienceError(err)
}
func (s *Service) exportCompletedExperiences(ctx context.Context, task domain.ProcessTask) {
	if task.CurrentNode != domain.NodeDone || s.experienceExporter == nil {
		return
	}
	st, err := s.experienceStore()
	if err != nil {
		return
	}
	state, err := st.ReadExperienceExport(ctx, task.TaskID)
	if err != nil || state.Generation == 0 || state.Generation == state.ExportedGeneration && state.Error == "" {
		return
	}
	// Task completion is committed already. Export failure stays in its independent saved state.
	_, _ = s.ExportExperiences(ctx, task.OriginHost, task.TaskID)
}
func (c *ControlCenter) GetExperiences(ctx context.Context, id, experienceID domain.ID, page int) (ExperienceDetail, error) {
	return c.core.GetExperiences(ctx, domain.HostCodex, id, experienceID, page)
}
func (c *ControlCenter) SearchExperiences(ctx context.Context, q store.ExperienceQuery) (store.ExperiencePage, error) {
	return c.core.SearchExperiences(ctx, q)
}
func (c *ControlCenter) ExportExperiences(ctx context.Context, id domain.ID) (store.ExperienceExport, error) {
	return c.core.ExportExperiences(ctx, domain.HostCodex, id)
}
func (c *ControlCenter) AddExperienceNote(ctx context.Context, m store.ExperienceMutation) (domain.Experience, error) {
	task, err := c.tasks.LoadTask(ctx, m.TaskID)
	if err != nil {
		return domain.Experience{}, experienceError(err)
	}
	m.Content = nil
	m.ChangeReason = ""
	return c.core.SaveExperience(ctx, task.OriginHost, m)
}
func renderExperiences(s store.ExperienceSnapshot) []byte {
	var b strings.Builder
	line := func(label, value string) { fmt.Fprintf(&b, "**%s**\n\n%s\n\n", label, value) }
	fmt.Fprint(&b, "# Task experiences / 任务经验\n\n")
	line("Task / 任务", s.Task.Intent.Request)
	line("Task ID", string(s.Task.TaskID))
	line("State / 状态", string(s.Task.CurrentNode))
	if s.Task.Outcome != nil {
		line("Outcome / 结果", s.Task.Outcome.Summary)
	}
	if s.Task.Blocker != nil {
		line("Blocker / 受阻情况", fmt.Sprintf("%s: %s\n\n%s", s.Task.Blocker.Cause, s.Task.Blocker.Message, s.Task.Blocker.RequiredResolution))
	}
	for _, evidence := range s.Task.Evidence {
		if evidence.Status == domain.EvidenceFailed {
			line("Recorded failed check / 已记录的失败检查", string(evidence.EvidenceID)+" · "+evidence.Name+"\n\n"+evidence.Summary)
		}
	}
	fmt.Fprint(&b, "This snapshot records reasoning from this task. Check its conditions and references before reusing it.\n本快照记录当时的判断，复用前请核对适用条件与引用。\n\n")
	fmt.Fprint(&b, "## Key takeaways / 关键收获\n\n")
	count := 0
	for _, e := range s.Experiences {
		if e.Content.Status == "supported" && count < 5 {
			fmt.Fprintf(&b, "- %s — %s\n", e.Content.Title, e.Content.NextChecks)
			count++
		}
	}
	if count == 0 {
		fmt.Fprint(&b, "No supported conclusion recorded / 尚无已有依据支持的结论。\n")
	}
	fmt.Fprint(&b, "\n")
	for _, e := range s.Experiences {
		fmt.Fprintf(&b, "## %s\n\n", e.Content.Title)
		line("Identity / 标识", fmt.Sprintf("%s · revision %d · %s", e.ExperienceID, e.Revision, e.Content.Status))
		line("Context / 阶段与时间", fmt.Sprintf("%s → %s · %s → %s\n\nContent digest: %s", e.Stage, e.UpdatedStage, e.CreatedAt.Format("2006-01-02T15:04:05Z07:00"), e.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"), e.ContentDigest))
		for _, p := range e.Projects {
			line("Project / 项目", fmt.Sprintf("%s · %s\n\n%s", p.Key, p.Group, p.Path))
		}
		for _, v := range []struct{ label, text string }{{"Problem / 问题", e.Content.Problem}, {"Cause / 原因", e.Content.Cause}, {"Resolution / 处理", e.Content.Resolution}, {"Basis / 判断依据", e.Content.Basis}, {"Applicability / 适用条件", e.Content.Applicability}, {"Next checks / 下次先检查", e.Content.NextChecks}, {"Revision reason / 修订原因", e.ChangeReason}} {
			line(v.label, v.text)
		}
		fmt.Fprint(&b, "### References / 引用\n\n")
		for _, r := range e.Content.References {
			fmt.Fprintf(&b, "- [%s] %s\n\n  %s\n\n", r.Kind, r.Locator, r.Summary)
		}
		fmt.Fprint(&b, "### User supplements / 用户补充\n\n")
		for _, n := range e.UserNotes {
			line(n.CreatedAt.Format("2006-01-02T15:04:05Z07:00"), n.Text)
		}
	}
	return []byte(b.String())
}
