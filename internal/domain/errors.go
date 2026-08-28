package domain

import (
	"sort"
	"strings"
)

type ErrorCode string

const (
	ErrorInvalidArgument            ErrorCode = "INVALID_ARGUMENT"
	ErrorNotGitRepository           ErrorCode = "NOT_GIT_REPOSITORY"
	ErrorTaskNotFound               ErrorCode = "TASK_NOT_FOUND"
	ErrorActiveTaskConflict         ErrorCode = "ACTIVE_TASK_CONFLICT"
	ErrorHostOwnershipConflict      ErrorCode = "HOST_OWNERSHIP_CONFLICT"
	ErrorRevisionConflict           ErrorCode = "REVISION_CONFLICT"
	ErrorActionStale                ErrorCode = "ACTION_STALE"
	ErrorRepositoryDrift            ErrorCode = "REPOSITORY_DRIFT"
	ErrorVerificationBudgetExceeded ErrorCode = "VERIFICATION_BUDGET_EXCEEDED"
	ErrorTaskBlocked                ErrorCode = "TASK_BLOCKED"
	ErrorTaskTerminal               ErrorCode = "TASK_TERMINAL"
	ErrorSchemaUnsupported          ErrorCode = "SCHEMA_UNSUPPORTED"
	ErrorProcessUnsupported         ErrorCode = "PROCESS_UNSUPPORTED"
	ErrorTransitionNotAllowed       ErrorCode = "TRANSITION_NOT_ALLOWED"
	ErrorRecoveryUnavailable        ErrorCode = "RECOVERY_UNAVAILABLE"
	ErrorStorageUnavailable         ErrorCode = "STORAGE_UNAVAILABLE"
	ErrorInternal                   ErrorCode = "INTERNAL_ERROR"
)

func (c ErrorCode) IsValid() bool {
	switch c {
	case ErrorInvalidArgument, ErrorNotGitRepository, ErrorTaskNotFound, ErrorActiveTaskConflict,
		ErrorHostOwnershipConflict, ErrorRevisionConflict, ErrorActionStale, ErrorRepositoryDrift,
		ErrorVerificationBudgetExceeded, ErrorTaskBlocked, ErrorTaskTerminal,
		ErrorSchemaUnsupported, ErrorProcessUnsupported, ErrorTransitionNotAllowed, ErrorRecoveryUnavailable,
		ErrorStorageUnavailable, ErrorInternal:
		return true
	default:
		return false
	}
}

// ViolationRule is a closed identifier for one field-level contract failure.
// Every rule carries a fixed message so a public failure never interpolates a
// submitted value, file content, storage path, environment variable or stack.
type ViolationRule string

const (
	RuleEvidenceSourceInvalid          ViolationRule = "evidence_source_invalid"
	RuleEvidenceStatusInvalid          ViolationRule = "evidence_status_invalid"
	RuleNonAutomatedCommandCountZero   ViolationRule = "non_automated_command_count_zero"
	RuleNonAutomatedFullSuiteFalse     ViolationRule = "non_automated_full_suite_false"
	RuleAutomatedCommandCountPositive  ViolationRule = "automated_command_count_positive"
	RuleAutomatedCommandCountLimit     ViolationRule = "automated_command_count_limit"
	RuleEvidenceNameDuplicate          ViolationRule = "evidence_name_duplicate"
	RuleActionKindPayloadMismatch      ViolationRule = "action_kind_payload_mismatch"
	RuleRequiredMemberMissing          ViolationRule = "required_member_missing"
	RuleUnknownMember                  ViolationRule = "unknown_member"
	RuleTextNotNormalized              ViolationRule = "text_not_normalized"
	RuleStringListDuplicate            ViolationRule = "string_list_duplicate"
	RuleStringListTooLong              ViolationRule = "string_list_too_long"
	RuleRepositoryPathInvalid          ViolationRule = "repository_path_invalid"
	RuleRepositoryMutationInconsistent ViolationRule = "repository_mutation_inconsistent"
	RuleRepositoryEffectNotObserved    ViolationRule = "repository_effect_not_observed"
	RuleProblemClassNotValidForNode    ViolationRule = "problem_class_not_valid_for_node"
	RuleArtifactRoleNotAllowed         ViolationRule = "artifact_role_not_allowed"
	RuleRepositoryEffectNotAllowed     ViolationRule = "repository_effect_not_allowed"
)

var violationMessages = map[ViolationRule]string{
	RuleEvidenceSourceInvalid:          "source must be automated, user, static or host_observed",
	RuleEvidenceStatusInvalid:          "status must be passed, failed, skipped, not_run or observed",
	RuleNonAutomatedCommandCountZero:   "command_count must equal 0 when source is user, static or host_observed",
	RuleNonAutomatedFullSuiteFalse:     "full_suite must be false when source is user, static or host_observed",
	RuleAutomatedCommandCountPositive:  "command_count must be at least 1 when source is automated",
	RuleAutomatedCommandCountLimit:     "command_count must not exceed the automatic verification limit",
	RuleEvidenceNameDuplicate:          "name must be unique within one evidence set",
	RuleActionKindPayloadMismatch:      "action_kind must match the payload branch of the current node",
	RuleRequiredMemberMissing:          "the closed contract requires this member",
	RuleUnknownMember:                  "the closed contract does not declare this member",
	RuleTextNotNormalized:              "text must be non-empty, trimmed and within the declared limit",
	RuleStringListDuplicate:            "the bounded list must not repeat an item",
	RuleStringListTooLong:              "the bounded list exceeds its item limit",
	RuleRepositoryPathInvalid:          "the repository contract path is invalid",
	RuleRepositoryMutationInconsistent: "changed_paths and no_file_changes contradict each other",
	RuleRepositoryEffectNotObserved:    "the declared current Action file changes were not observed",
	RuleProblemClassNotValidForNode:    "problem_class is not allowed for the current node",
	RuleArtifactRoleNotAllowed:         "the current Action does not allow this artifact role",
	RuleRepositoryEffectNotAllowed:     "the current Action does not allow the submitted repository effect",
}

func (r ViolationRule) IsValid() bool {
	_, ok := violationMessages[r]
	return ok
}
func (r ViolationRule) Message() string { return violationMessages[r] }

// GuardRule is a closed identifier for one transition-guard failure. A guard
// failure describes a guard condition only; repository drift, member format
// failures and unknown work items are never reported here.
type GuardRule string

const (
	GuardForwardFindingsEmpty           GuardRule = "forward_findings_empty"
	GuardProblemFindingsPresent         GuardRule = "problem_findings_present"
	GuardProblemClassTransitionMismatch GuardRule = "problem_class_transition_mismatch"
)

var guardMessages = map[GuardRule]string{
	GuardForwardFindingsEmpty:           "findings must be empty when problem_class is none",
	GuardProblemFindingsPresent:         "findings must not be empty when problem_class is not none",
	GuardProblemClassTransitionMismatch: "problem_class must match the problem class the selected transition reports",
}

func (r GuardRule) IsValid() bool {
	_, ok := guardMessages[r]
	return ok
}
func (r GuardRule) Message() string { return guardMessages[r] }

// ContractViolation names one failing request member. Path is a stable path
// relative to the request root; members use `.name` and array entries use
// `[index]`.
type ContractViolation struct {
	Path    string        `json:"path"`
	Rule    ViolationRule `json:"rule"`
	Message string        `json:"message"`
}

// GuardFailure names the guard that was not satisfied plus its failing members.
type GuardFailure struct {
	GuardID  TransitionGuardID   `json:"guard_id"`
	Failures []ContractViolation `json:"failures"`
}

// Error is a stable, typed, non-sensitive domain failure.
type Error struct {
	Code    ErrorCode
	Message string
	// Violations is the closed field-level detail of a contract failure.
	Violations []ContractViolation
	// Guard is the closed guard detail of a transition failure.
	Guard *GuardFailure
	// ZeroWrite records that Core proved this request failed before any Task,
	// Event, Claim or Evidence write. Only a proven zero-write failure may
	// offer a bounded correction of the same Action.
	ZeroWrite bool
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return string(e.Code) + ": " + e.Message
}

func (e *Error) Is(target error) bool {
	other, ok := target.(*Error)
	return ok && e != nil && e.Code == other.Code
}

// Violation builds one field-level violation with the fixed message of its rule.
// An unknown rule or an unsafe path yields the zero value, which callers drop.
func Violation(path string, rule ViolationRule) ContractViolation {
	if !rule.IsValid() || !ValidViolationPath(path) {
		return ContractViolation{}
	}
	return ContractViolation{Path: path, Rule: rule, Message: rule.Message()}
}

// GuardViolation builds one guard failure entry with the fixed message of its rule.
func GuardViolation(path string, rule GuardRule) ContractViolation {
	if !rule.IsValid() || !ValidViolationPath(path) {
		return ContractViolation{}
	}
	return ContractViolation{Path: path, Rule: ViolationRule(rule), Message: rule.Message()}
}

// ValidViolationPath accepts only lowercase member names, `.` separators and
// bounded `[index]` entries. The closed grammar is what guarantees a path can
// never carry submitted data.
func ValidViolationPath(path string) bool {
	if path == "" || len(path) > MaxIdentifierBytes*4 {
		return false
	}
	for _, segment := range strings.Split(path, ".") {
		name := segment
		if open := strings.IndexByte(segment, '['); open >= 0 {
			if !strings.HasSuffix(segment, "]") {
				return false
			}
			index := segment[open+1 : len(segment)-1]
			if index == "" || len(index) > 4 {
				return false
			}
			for _, digit := range index {
				if digit < '0' || digit > '9' {
					return false
				}
			}
			name = segment[:open]
		}
		if name == "" {
			return false
		}
		for _, letter := range name {
			if (letter < 'a' || letter > 'z') && letter != '_' {
				return false
			}
		}
	}
	return true
}

// InvalidArgumentViolations reports a closed contract failure with field-level
// detail. It is always a proven zero-write failure because Core produces it
// before any mutation.
func InvalidArgumentViolations(violations ...ContractViolation) *Error {
	retained := retainViolations(violations)
	if len(retained) == 0 {
		return ErrInvalidArgument
	}
	return &Error{Code: ErrorInvalidArgument, Message: ErrInvalidArgument.Message, Violations: retained, ZeroWrite: true}
}

// TransitionGuardFailure reports one unsatisfied transition guard.
func TransitionGuardFailure(guard TransitionGuardID, failures ...ContractViolation) *Error {
	retained := retainViolations(failures)
	if !guard.IsValid() || len(retained) == 0 {
		return ErrTransitionNotAllowed
	}
	return &Error{Code: ErrorTransitionNotAllowed, Message: ErrTransitionNotAllowed.Message, Guard: &GuardFailure{GuardID: guard, Failures: retained}, ZeroWrite: true}
}

// WithoutZeroWriteProof returns the same failure without its zero-write proof.
// A caller that cannot prove the request failed before every write uses this so
// no bounded correction is offered.
func WithoutZeroWriteProof(err error) error {
	typed, ok := err.(*Error)
	if !ok || typed == nil || !typed.ZeroWrite {
		return err
	}
	clone := *typed
	clone.ZeroWrite = false
	return &clone
}

// ViolationPaths returns the stable, de-duplicated paths of a structured failure.
func ViolationPaths(err error) []string {
	typed, ok := err.(*Error)
	if !ok || typed == nil {
		return nil
	}
	entries := typed.Violations
	if typed.Guard != nil {
		entries = append(append([]ContractViolation(nil), entries...), typed.Guard.Failures...)
	}
	seen := make(map[string]bool, len(entries))
	out := make([]string, 0, len(entries))
	for _, entry := range entries {
		if seen[entry.Path] {
			continue
		}
		seen[entry.Path] = true
		out = append(out, entry.Path)
	}
	return out
}

// retainViolations drops unusable entries and orders the remainder by path so
// the same input always produces the same public detail and order.
func retainViolations(violations []ContractViolation) []ContractViolation {
	seen := map[ContractViolation]bool{}
	out := make([]ContractViolation, 0, len(violations))
	for _, violation := range violations {
		if violation.Path == "" || violation.Message == "" || seen[violation] {
			continue
		}
		seen[violation] = true
		out = append(out, violation)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Path != out[j].Path {
			return out[i].Path < out[j].Path
		}
		return out[i].Rule < out[j].Rule
	})
	return out
}

func NewError(code ErrorCode, message string) *Error {
	if !code.IsValid() {
		code = ErrorInternal
	}
	if normalized, err := normalizeRequiredText(message, MaxErrorMessageBytes); err == nil {
		message = normalized
	} else {
		message = "domain operation failed"
	}
	return &Error{Code: code, Message: message}
}

var (
	ErrInvalidArgument            = &Error{Code: ErrorInvalidArgument, Message: "the domain value is invalid"}
	ErrNotGitRepository           = &Error{Code: ErrorNotGitRepository, Message: "the path is not a Git repository"}
	ErrTaskNotFound               = &Error{Code: ErrorTaskNotFound, Message: "the task was not found"}
	ErrActiveTaskConflict         = &Error{Code: ErrorActiveTaskConflict, Message: "the repository already has an active task"}
	ErrHostOwnershipConflict      = &Error{Code: ErrorHostOwnershipConflict, Message: "the task belongs to another host"}
	ErrRevisionConflict           = &Error{Code: ErrorRevisionConflict, Message: "the task revision is stale"}
	ErrActionStale                = &Error{Code: ErrorActionStale, Message: "the action identity is stale"}
	ErrRepositoryDrift            = &Error{Code: ErrorRepositoryDrift, Message: "the repository binding has changed"}
	ErrVerificationBudgetExceeded = &Error{Code: ErrorVerificationBudgetExceeded, Message: "the verification budget was exceeded"}
	ErrTaskBlocked                = &Error{Code: ErrorTaskBlocked, Message: "the task is blocked"}
	ErrTaskTerminal               = &Error{Code: ErrorTaskTerminal, Message: "the task is terminal"}
	ErrSchemaUnsupported          = &Error{Code: ErrorSchemaUnsupported, Message: "pre-graph data is unsupported; choose a fresh data directory or archive, rename, or delete the old directory outside Core"}
	ErrProcessUnsupported         = &Error{Code: ErrorProcessUnsupported, Message: "the stored process definition is unsupported"}
	ErrTransitionNotAllowed       = &Error{Code: ErrorTransitionNotAllowed, Message: "the transition is not allowed from the current node"}
	ErrRecoveryUnavailable        = &Error{Code: ErrorRecoveryUnavailable, Message: "recovery is unavailable for this operation"}
	ErrStorageUnavailable         = &Error{Code: ErrorStorageUnavailable, Message: "storage is unavailable"}
	ErrInternal                   = &Error{Code: ErrorInternal, Message: "an internal error occurred"}
)
