package domain

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// ExperienceContent records the Host's reasoning from work already performed.
type ExperienceContent struct {
	Title          string                `json:"title"`
	Problem        string                `json:"problem"`
	Cause          string                `json:"cause"`
	Resolution     string                `json:"resolution"`
	Basis          string                `json:"basis"`
	Applicability  string                `json:"applicability"`
	NextChecks     string                `json:"next_checks"`
	Status         string                `json:"status"`
	RepositoryKeys []RepositoryKey       `json:"repository_keys"`
	References     []ExperienceReference `json:"references"`
}
type ExperienceReference struct {
	Kind    string `json:"kind"`
	Locator string `json:"locator"`
	Summary string `json:"summary"`
}
type ExperienceProject struct {
	Key   RepositoryKey `json:"key"`
	Group Digest        `json:"group"`
	Path  string        `json:"path"`
}
type ExperienceNote struct {
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

// Each revision is immutable; content revisions retain independently appended user notes.
type Experience struct {
	TaskID        ID                  `json:"task_id"`
	ExperienceID  ID                  `json:"experience_id"`
	Revision      uint64              `json:"revision"`
	Content       ExperienceContent   `json:"content"`
	ChangeReason  string              `json:"change_reason"`
	Stage         NodeID              `json:"stage"`
	UpdatedStage  NodeID              `json:"updated_stage"`
	ContentDigest Digest              `json:"content_digest"`
	Projects      []ExperienceProject `json:"projects"`
	UserNotes     []ExperienceNote    `json:"user_notes"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
}

func experienceText(value string, max int) bool {
	return value != "" && value == strings.TrimSpace(value) && utf8.ValidString(value) && len(value) <= max && !strings.ContainsRune(value, 0)
}
func ValidateExperienceText(path, value string) error {
	if !experienceText(value, 8192) {
		return InvalidArgumentViolations(Violation(path, RuleTextNotNormalized))
	}
	return nil
}
func (c ExperienceContent) Validate() error {
	for _, item := range []struct{ name, value string }{{"title", c.Title}, {"problem", c.Problem}, {"cause", c.Cause}, {"resolution", c.Resolution}, {"basis", c.Basis}, {"applicability", c.Applicability}, {"next_checks", c.NextChecks}} {
		limit := 8192
		if item.name == "title" {
			limit = 240
		}
		if !experienceText(item.value, limit) {
			return InvalidArgumentViolations(Violation("content."+item.name, RuleTextNotNormalized))
		}
	}
	if c.Status != "pending" && c.Status != "supported" && c.Status != "refuted" {
		return InvalidArgumentViolations(Violation("content.status", RuleEnumValueInvalid))
	}
	if len(c.RepositoryKeys) == 0 || len(c.RepositoryKeys) > 8 {
		return InvalidArgumentViolations(Violation("content.repository_keys", RuleRequiredCollectionNonEmpty))
	}
	seen := map[RepositoryKey]bool{}
	for i, k := range c.RepositoryKeys {
		if !k.IsValid() || seen[k] {
			return InvalidArgumentViolations(Violation(fmt.Sprintf("content.repository_keys[%d]", i), RuleKnownIdentifierRequired))
		}
		seen[k] = true
	}
	if c.References == nil || len(c.References) > 32 || c.Status != "pending" && len(c.References) == 0 {
		return InvalidArgumentViolations(Violation("content.references", RuleRequiredCollectionNonEmpty))
	}
	for i, r := range c.References {
		if r.Kind != "code" && r.Kind != "log" && r.Kind != "discussion" && r.Kind != "verification" {
			return InvalidArgumentViolations(Violation(fmt.Sprintf("content.references[%d].kind", i), RuleEnumValueInvalid))
		}
		for _, v := range []struct{ name, value string }{{"locator", r.Locator}, {"summary", r.Summary}} {
			if !experienceText(v.value, 8192) {
				return InvalidArgumentViolations(Violation(fmt.Sprintf("content.references[%d].%s", i, v.name), RuleTextNotNormalized))
			}
		}
	}
	return nil
}
func (e Experience) Validate() error {
	if !e.TaskID.IsValid() || !e.ExperienceID.IsValid() || e.Revision == 0 || !e.Stage.IsValid() || !e.UpdatedStage.IsValid() || !e.ContentDigest.IsValid() || e.CreatedAt.IsZero() || e.UpdatedAt.Before(e.CreatedAt) || e.CreatedAt.Location() != time.UTC || e.UpdatedAt.Location() != time.UTC || !experienceText(e.ChangeReason, 8192) || e.UserNotes == nil || len(e.Projects) != len(e.Content.RepositoryKeys) {
		return ErrInvalidArgument
	}
	if err := e.Content.Validate(); err != nil {
		return err
	}
	for i, p := range e.Projects {
		if p.Key != e.Content.RepositoryKeys[i] || !p.Group.IsValid() || p.Path == "" {
			return ErrInvalidArgument
		}
	}
	for _, n := range e.UserNotes {
		if !experienceText(n.Text, 8192) || n.CreatedAt.Before(e.CreatedAt) || n.CreatedAt.After(e.UpdatedAt) || n.CreatedAt.Location() != time.UTC {
			return ErrInvalidArgument
		}
	}
	return nil
}
