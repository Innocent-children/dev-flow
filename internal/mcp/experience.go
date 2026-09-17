package mcp

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

const (
	ToolSaveExperience    = "dev_flow_save_experience"
	ToolAddExperienceNote = "dev_flow_add_experience_note"
	ToolGetExperiences    = "dev_flow_get_experiences"
	ToolSearchExperiences = "dev_flow_search_experiences"
	ToolExportExperiences = "dev_flow_export_experiences"
)

type experienceWire struct {
	Host             domain.Host               `json:"host"`
	TaskID           domain.ID                 `json:"task_id"`
	ExperienceID     domain.ID                 `json:"experience_id"`
	RequestID        domain.ID                 `json:"request_id"`
	ExpectedRevision uint64                    `json:"expected_revision"`
	Content          *domain.ExperienceContent `json:"content"`
	ChangeReason     string                    `json:"change_reason"`
	UserNote         string                    `json:"user_note"`
	Project          string                    `json:"project"`
	Text             string                    `json:"text"`
	Page             int                       `json:"page"`
}

func experienceTool(name string) bool {
	switch name {
	case ToolSaveExperience, ToolAddExperienceNote, ToolGetExperiences, ToolSearchExperiences, ToolExportExperiences:
		return true
	}
	return false
}
func experienceTextSchema(max int) map[string]any {
	return map[string]any{"type": "string", "minLength": 1, "maxLength": max}
}
func experienceContentSchema() map[string]any {
	p := map[string]any{}
	required := []string{"title", "problem", "cause", "resolution", "basis", "applicability", "next_checks", "status", "repository_keys", "references"}
	for _, k := range required[:7] {
		p[k] = experienceTextSchema(8192)
	}
	p["title"] = experienceTextSchema(240)
	p["status"] = map[string]any{"type": "string", "enum": []string{"pending", "supported", "refuted"}}
	p["repository_keys"] = map[string]any{"type": "array", "minItems": 1, "maxItems": 8, "items": id()}
	p["references"] = map[string]any{"type": "array", "maxItems": 32, "items": obj([]string{"kind", "locator", "summary"}, map[string]any{"kind": map[string]any{"type": "string", "enum": []string{"code", "log", "discussion", "verification"}}, "locator": experienceTextSchema(8192), "summary": experienceTextSchema(8192)})}
	return obj(required, p)
}
func experienceTools() []ToolDefinition {
	host := map[string]any{"type": "string", "enum": []string{"codex", "deepseek"}}
	base := map[string]any{"host": host, "task_id": id()}
	mutation := mergeProperties(base, map[string]any{"experience_id": id(), "request_id": id(), "expected_revision": map[string]any{"type": "integer", "minimum": 0}})
	return []ToolDefinition{
		makeTool(ToolSaveExperience, "Create or revise task experience from existing facts. Supply a stable request_id and experience_id; expected_revision is the experience revision (0 creates). Preserve useful rejected reasoning in basis. Does not change Task revision, Action or node.", obj([]string{"host", "task_id", "experience_id", "request_id", "expected_revision", "content", "change_reason"}, mergeProperties(mutation, map[string]any{"content": experienceContentSchema(), "change_reason": experienceTextSchema(8192)})), false, true, false),
		makeTool(ToolAddExperienceNote, "Append the user's actual supplement to an experience. Retain the same request_id after response loss. This is independent of comprehension confirmation.", obj([]string{"host", "task_id", "experience_id", "request_id", "expected_revision", "user_note"}, mergeProperties(mutation, map[string]any{"user_note": experienceTextSchema(8192)})), false, true, false),
		makeTool(ToolGetExperiences, "Read current task experiences and export state, including archived tasks. Supply experience_id to read its revision history. Historical reasoning is not current verification authority.", obj([]string{"host", "task_id"}, mergeProperties(base, map[string]any{"experience_id": id(), "page": map[string]any{"type": "integer", "minimum": 1, "maximum": 1000000}})), true, true, false),
		makeTool(ToolSearchExperiences, "Find current experiences by project group ID or saved repository path and keyword, including archived tasks. Pages contain at most 5 matches.", obj([]string{"host"}, map[string]any{"host": host, "task_id": id(), "project": map[string]any{"type": "string", "maxLength": 4096}, "text": map[string]any{"type": "string", "maxLength": 512}, "page": map[string]any{"type": "integer", "minimum": 1, "maximum": 1000000}}), true, true, false),
		makeTool(ToolExportExperiences, "Export saved task experiences to a stable Markdown path outside repositories. Works in any task state. Inspect result.error and generation/exported_generation; failure remains retryable without changing task completion.", obj([]string{"host", "task_id"}, base), false, true, false),
	}
}
func validateExperienceWire(name string, raw []byte) error {
	var members map[string]json.RawMessage
	_ = json.Unmarshal(raw, &members)
	keys := make([]string, 0, len(members))
	for key := range members {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := members[key]
		if string(value) == "null" {
			return domain.InvalidArgumentViolations(domain.Violation(key, domain.RuleRequiredMemberMissing))
		}
	}
	var w experienceWire
	if err := decodeClosed(raw, &w); err != nil {
		return err
	}
	if !w.Host.IsValid() {
		return domain.InvalidArgumentViolations(domain.Violation("host", domain.RuleEnumValueInvalid))
	}
	if _, present := members["page"]; present && (w.Page < 1 || w.Page > 1000000) {
		return domain.InvalidArgumentViolations(domain.Violation("page", domain.RuleCurrentValueRequired))
	}
	for _, key := range []string{"task_id", "experience_id"} {
		value := w.TaskID
		if key == "experience_id" {
			value = w.ExperienceID
		}
		if _, present := members[key]; present && !value.IsValid() {
			return domain.InvalidArgumentViolations(domain.Violation(key, domain.RuleKnownIdentifierRequired))
		}
	}
	if name != ToolSearchExperiences && !w.TaskID.IsValid() {
		return domain.InvalidArgumentViolations(domain.Violation("task_id", domain.RuleKnownIdentifierRequired))
	}
	if name == ToolSaveExperience || name == ToolAddExperienceNote {
		if !w.ExperienceID.IsValid() || !w.RequestID.IsValid() {
			return domain.ErrInvalidArgument
		}
		if name == ToolSaveExperience {
			if w.Content == nil {
				return domain.InvalidArgumentViolations(domain.Violation("content", domain.RuleRequiredMemberMissing))
			}
			var fields map[string]json.RawMessage
			_ = json.Unmarshal(raw, &fields)
			required := []string{"title", "problem", "cause", "resolution", "basis", "applicability", "next_checks", "status", "repository_keys", "references"}
			violations := missingRequestMembers(fields["content"], required...)
			for i := range violations {
				violations[i].Path = "content." + violations[i].Path
			}
			if len(violations) > 0 {
				return domain.InvalidArgumentViolations(violations...)
			}
			if err := w.Content.Validate(); err != nil {
				return err
			}
			return domain.ValidateExperienceText("change_reason", w.ChangeReason)
		}
		if w.ExpectedRevision == 0 {
			return domain.InvalidArgumentViolations(domain.Violation("expected_revision", domain.RuleCurrentValueRequired))
		}
		return domain.ValidateExperienceText("user_note", w.UserNote)
	}
	if w.ExperienceID != "" && !w.ExperienceID.IsValid() {
		return domain.ErrInvalidArgument
	}
	return nil
}
func (s *Server) dispatchExperience(ctx context.Context, name string, id domain.ID, raw []byte) EncodedResult {
	var w experienceWire
	_ = decodeClosed(raw, &w)
	var result any
	var err error
	switch name {
	case ToolSaveExperience, ToolAddExperienceNote:
		result, err = s.application.SaveExperience(ctx, w.Host, store.ExperienceMutation{TaskID: w.TaskID, ExperienceID: w.ExperienceID, RequestID: w.RequestID, ExpectedRevision: w.ExpectedRevision, Content: w.Content, ChangeReason: w.ChangeReason, UserNote: w.UserNote})
	case ToolGetExperiences:
		result, err = s.application.GetExperiences(ctx, w.Host, w.TaskID, w.ExperienceID, w.Page)
	case ToolSearchExperiences:
		result, err = s.application.SearchExperiences(ctx, store.ExperienceQuery{TaskID: w.TaskID, Project: w.Project, Text: w.Text, Page: w.Page})
	case ToolExportExperiences:
		result, err = s.application.ExportExperiences(ctx, w.Host, w.TaskID)
	}
	if err != nil {
		return EncodeError(string(id), name, err)
	}
	return EncodeSuccess(string(id), name, result)
}
func experienceExportSchema() map[string]any {
	return obj([]string{"task_id", "generation", "exported_generation", "path", "error"}, map[string]any{"task_id": id(), "generation": map[string]any{"type": "integer", "minimum": 0}, "exported_generation": map[string]any{"type": "integer", "minimum": 0}, "path": map[string]any{"type": "string"}, "error": map[string]any{"type": "string"}})
}
func experienceRecordSchema() map[string]any {
	return obj([]string{"task_id", "experience_id", "revision", "content", "change_reason", "stage", "updated_stage", "content_digest", "projects", "user_notes", "created_at", "updated_at"}, map[string]any{
		"task_id": id(), "experience_id": id(), "revision": map[string]any{"type": "integer", "minimum": 1}, "content": experienceContentSchema(), "change_reason": experienceTextSchema(8192), "stage": str(), "updated_stage": str(), "content_digest": digest(), "created_at": str(), "updated_at": str(),
		"projects":   map[string]any{"type": "array", "items": obj([]string{"key", "group", "path"}, map[string]any{"key": id(), "group": digest(), "path": str()})},
		"user_notes": map[string]any{"type": "array", "items": obj([]string{"text", "created_at"}, map[string]any{"text": experienceTextSchema(8192), "created_at": str()})},
	})
}
func experienceResultSchema(name string) map[string]any {
	switch name {
	case ToolSaveExperience, ToolAddExperienceNote:
		return experienceRecordSchema()
	case ToolExportExperiences:
		return experienceExportSchema()
	case ToolGetExperiences:
		return obj([]string{"task_id", "task_state", "experiences", "export", "page", "has_next"}, map[string]any{"page": map[string]any{"type": "integer", "minimum": 1}, "has_next": map[string]any{"type": "boolean"}, "task_id": id(), "task_state": str(), "experiences": map[string]any{"type": "array", "items": experienceRecordSchema()}, "export": experienceExportSchema()})
	default:
		return obj([]string{"items", "page", "has_next"}, map[string]any{"page": map[string]any{"type": "integer", "minimum": 1}, "has_next": map[string]any{"type": "boolean"}, "items": map[string]any{"type": "array", "items": obj([]string{"experience", "task_summary", "task_state", "archived"}, map[string]any{"experience": experienceRecordSchema(), "task_summary": experienceTextSchema(8192), "task_state": str(), "archived": map[string]any{"type": "boolean"}})}})
	}
}
