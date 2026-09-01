package domain

import (
	"sort"
	"strings"
	"time"
)

// FileScopeDecision records the developer's choice for one prepared write.
type FileScopeDecision string

const (
	FileScopePending     FileScopeDecision = "pending"
	FileScopeAllowOnce   FileScopeDecision = "allow_once"
	FileScopeExpandScope FileScopeDecision = "expand_scope"
	FileScopeReject      FileScopeDecision = "reject"
)

func (d FileScopeDecision) IsValid() bool {
	return d == FileScopePending || d == FileScopeAllowOnce || d == FileScopeExpandScope || d == FileScopeReject
}

func (d FileScopeDecision) IsDeveloperChoice() bool {
	return d == FileScopeAllowOnce || d == FileScopeExpandScope || d == FileScopeReject
}

// FileScopeApplicability makes the duration of one decision explicit.
type FileScopeApplicability string

const (
	FileScopePendingWrite     FileScopeApplicability = "pending_write"
	FileScopeExactWrite       FileScopeApplicability = "exact_write"
	FileScopeTaskPlanRevision FileScopeApplicability = "task_plan_revision"
	FileScopeTaskPlanUpdate   FileScopeApplicability = "task_plan_update"
)

func (a FileScopeApplicability) IsValid() bool {
	return a == FileScopePendingWrite || a == FileScopeExactWrite ||
		a == FileScopeTaskPlanRevision || a == FileScopeTaskPlanUpdate
}

// FileScopeRecord keeps one prepared write and the developer decision that followed it.
type FileScopeRecord struct {
	RequestID        ID                     `json:"request_id"`
	Paths            []string               `json:"paths"`
	IntentDigest     Digest                 `json:"intent_digest"`
	TaskPlanRevision uint32                 `json:"task_plan_revision"`
	SourceNode       NodeID                 `json:"source_node"`
	SourceActionID   ID                     `json:"source_action_id"`
	Decision         FileScopeDecision      `json:"decision"`
	Reason           string                 `json:"reason"`
	Applicability    FileScopeApplicability `json:"applicability"`
	AllowedActionID  *ID                    `json:"allowed_action_id,omitempty"`
	Consumed         bool                   `json:"consumed"`
	CreatedAt        time.Time              `json:"created_at"`
	DecidedAt        *time.Time             `json:"decided_at,omitempty"`
}

func (r FileScopeRecord) Validate() error {
	if !r.RequestID.IsValid() || len(r.Paths) == 0 || len(r.Paths) > MaxFileScopePaths ||
		!r.IntentDigest.IsValid() || r.TaskPlanRevision == 0 ||
		(r.SourceNode != NodeImplement && r.SourceNode != NodeRefactor) ||
		!r.SourceActionID.IsValid() || !r.Decision.IsValid() || !r.Applicability.IsValid() ||
		validateUTC(r.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	for index, path := range r.Paths {
		if ValidateRepositoryContractPath(path) != nil || index > 0 && r.Paths[index-1] >= path {
			return ErrInvalidArgument
		}
	}
	switch r.Decision {
	case FileScopePending:
		if r.Reason != "" || r.Applicability != FileScopePendingWrite || r.AllowedActionID != nil || r.Consumed || r.DecidedAt != nil {
			return ErrInvalidArgument
		}
	case FileScopeAllowOnce:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeExactWrite ||
			r.AllowedActionID == nil || !r.AllowedActionID.IsValid() || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
	case FileScopeExpandScope:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeTaskPlanUpdate ||
			r.AllowedActionID != nil || r.Consumed || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
	case FileScopeReject:
		if requireNormalizedText(r.Reason, MaxReasonBytes, true) != nil || r.Applicability != FileScopeTaskPlanRevision ||
			r.AllowedActionID != nil || r.Consumed || r.DecidedAt == nil || validateUTC(*r.DecidedAt) != nil {
			return ErrInvalidArgument
		}
	}
	return nil
}

type FileScopeDecisionInput struct {
	Choice FileScopeDecision `json:"choice"`
	Reason string            `json:"reason"`
}

func (d FileScopeDecisionInput) Validate() error {
	if !d.Choice.IsDeveloperChoice() || requireNormalizedText(d.Reason, MaxReasonBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (t ProcessTask) PathExpectedByCurrentPlan(path string) bool {
	if t.TaskPlan == nil {
		return false
	}
	for _, item := range t.TaskPlan.WorkItems {
		for _, expected := range item.ExpectedPaths {
			if expected == path {
				return true
			}
			if strings.HasSuffix(expected, "/**") {
				prefix := strings.TrimSuffix(expected, "/**")
				if prefix != "" && strings.HasPrefix(path, prefix+"/") {
					return true
				}
			}
		}
	}
	return false
}

func (t ProcessTask) UnexplainedChangedPaths(current []string) []string {
	base := t.TaskChangedPaths
	if len(base) == 0 && t.Implementation != nil {
		base = t.Implementation.ChangedPaths
	}
	paths := mergeFileScopePaths(base, current)
	authorized := map[string]bool{}
	for _, record := range t.FileScopeRecords {
		if record.Decision != FileScopeAllowOnce {
			continue
		}
		if record.Consumed {
			for _, path := range record.Paths {
				authorized[path] = true
			}
			continue
		}
		if t.CurrentAction != nil && record.AllowedActionID != nil && *record.AllowedActionID == t.CurrentAction.ActionID && containsFileScopePaths(current, record.Paths) {
			for _, path := range record.Paths {
				authorized[path] = true
			}
		}
	}
	unexplained := []string{}
	for _, path := range paths {
		if !t.PathExpectedByCurrentPlan(path) && !authorized[path] {
			unexplained = append(unexplained, path)
		}
	}
	return unexplained
}

func mergeFileScopePaths(left, right []string) []string {
	set := make(map[string]bool, len(left)+len(right))
	for _, path := range left {
		set[path] = true
	}
	for _, path := range right {
		set[path] = true
	}
	result := make([]string, 0, len(set))
	for path := range set {
		result = append(result, path)
	}
	sort.Strings(result)
	return result
}

func containsFileScopePaths(values, wanted []string) bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	for _, value := range wanted {
		if !set[value] {
			return false
		}
	}
	return true
}
