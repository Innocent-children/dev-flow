package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"io"
	"sort"
	"strings"
	"unicode/utf8"
)

type openWire struct {
	Host                   domain.Host                `json:"host"`
	RepositoryPath         string                     `json:"repository_path"`
	PrimaryRepositoryKey   domain.RepositoryKey       `json:"primary_repository_key"`
	AdditionalRepositories []additionalRepositoryWire `json:"additional_repositories"`
	NewTask                *struct {
		Request                 string                    `json:"request"`
		InitialScope            []string                  `json:"initial_scope"`
		InitialOutOfScope       []string                  `json:"initial_out_of_scope"`
		KnownAcceptanceCriteria []string                  `json:"known_acceptance_criteria"`
		VerificationBudget      domain.VerificationBudget `json:"verification_budget"`
		MethodProfile           domain.MethodProfile      `json:"method_profile"`
	} `json:"new_task"`
}
type additionalRepositoryWire struct {
	Key            domain.RepositoryKey `json:"key"`
	RepositoryPath string               `json:"repository_path"`
}
type readWire struct {
	Host           domain.Host         `json:"host"`
	TaskID         domain.ID           `json:"task_id"`
	OperationProbe *operationProbeWire `json:"operation_probe"`
}
type operationProbeWire struct {
	OperationID             domain.ID         `json:"operation_id"`
	ProcessID               domain.ProcessID  `json:"process_id"`
	ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
	SourceCursor            domain.NodeID     `json:"source_cursor"`
	ExpectedRevision        uint64            `json:"expected_revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	Payload                 json.RawMessage   `json:"payload"`
}
type applyWire struct {
	RequestID               domain.ID          `json:"request_id"`
	Host                    domain.Host        `json:"host"`
	TaskID                  domain.ID          `json:"task_id"`
	Revision                uint64             `json:"revision"`
	ActionID                domain.ID          `json:"action_id"`
	ActionKind              domain.ActionKind  `json:"action_kind"`
	ProcessID               domain.ProcessID   `json:"process_id"`
	ProcessDefinitionDigest domain.Digest      `json:"process_definition_digest"`
	SourceCursor            domain.NodeID      `json:"source_cursor"`
	RepositoryBindingDigest domain.Digest      `json:"repository_binding_digest"`
	Payload                 json.RawMessage    `json:"payload"`
	RecoveryApply           *recoveryApplyWire `json:"recovery_apply"`
}
type recoveryApplyWire struct {
	OperationID  domain.ID     `json:"operation_id"`
	SourceCursor domain.NodeID `json:"source_cursor"`
}
type artifactSubmissionWire struct {
	Path    string        `json:"path"`
	Digest  domain.Digest `json:"digest"`
	Summary string        `json:"summary"`
}
type methodResultSubmissionWire struct {
	Capability string `json:"capability"`
	Summary    string `json:"summary"`
}
type submitActionWire struct {
	Host         domain.Host         `json:"host"`
	TaskID       domain.ID           `json:"task_id"`
	ActionID     domain.ID           `json:"action_id"`
	TransitionID domain.TransitionID `json:"transition_id"`
	Summary      string              `json:"summary"`
	Reason       string              `json:"reason"`
	Artifacts    struct {
		Current      []artifactSubmissionWire `json:"current"`
		OtherProcess []artifactSubmissionWire `json:"other_process"`
	} `json:"artifacts"`
	MethodResults map[domain.MethodStepID]methodResultSubmissionWire `json:"method_results"`
	NodeResult    json.RawMessage                                    `json:"node_result"`
}
type actionReferenceWire struct {
	Host     domain.Host `json:"host"`
	TaskID   domain.ID   `json:"task_id"`
	ActionID domain.ID   `json:"action_id"`
}
type cancelWire struct {
	RequestID domain.ID   `json:"request_id"`
	Host      domain.Host `json:"host"`
	TaskID    domain.ID   `json:"task_id"`
	Revision  uint64      `json:"revision"`
	Reason    string      `json:"reason"`
}

func decodeClosed(raw []byte, out any) error {
	if !utf8.Valid(raw) || rejectDuplicateMembers(raw) != nil {
		return domain.ErrInvalidArgument
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return domain.ErrInvalidArgument
	}
	var x any
	if err := d.Decode(&x); err != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}
func rejectDuplicateMembers(raw []byte) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	var walk func() error
	walk = func() error {
		token, err := d.Token()
		if err != nil {
			return err
		}
		delim, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		if delim == '{' {
			seen := map[string]bool{}
			for d.More() {
				keyToken, err := d.Token()
				if err != nil {
					return err
				}
				key := keyToken.(string)
				if seen[key] {
					return fmt.Errorf("duplicate %s", key)
				}
				seen[key] = true
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		}
		if delim == '[' {
			for d.More() {
				if err := walk(); err != nil {
					return err
				}
			}
			_, err = d.Token()
			return err
		}
		return nil
	}
	return walk()
}
func ValidateToolInput(tool string, raw []byte) error {
	if kind, ok := submissionKindForTool(tool); ok {
		return validateSubmitActionInput(kind, raw)
	}
	switch tool {
	case ToolServerInfo:
		var v struct{}
		return decodeClosed(raw, &v)
	case ToolOpenTask:
		if !hasKeys(raw, "host", "repository_path") {
			return domain.ErrInvalidArgument
		}
		var v openWire
		if decodeClosed(raw, &v) != nil || !v.Host.IsValid() || !validRepositoryPath(v.RepositoryPath) || len(v.AdditionalRepositories) > domain.MaxAdditionalRepositories {
			return domain.ErrInvalidArgument
		}
		if nullField(raw, "primary_repository_key") || nullField(raw, "additional_repositories") {
			return domain.ErrInvalidArgument
		}
		primaryKey := v.PrimaryRepositoryKey
		if primaryKey == "" {
			primaryKey = domain.DefaultPrimaryRepositoryKey
		}
		if !primaryKey.IsValid() {
			return domain.ErrInvalidArgument
		}
		keys := map[domain.RepositoryKey]bool{primaryKey: true}
		for _, repository := range v.AdditionalRepositories {
			if !repository.Key.IsValid() || keys[repository.Key] || !validRepositoryPath(repository.RepositoryPath) {
				return domain.ErrInvalidArgument
			}
			keys[repository.Key] = true
		}
		if v.NewTask == nil && (v.PrimaryRepositoryKey != "" || len(v.AdditionalRepositories) != 0) {
			return domain.ErrInvalidArgument
		}
		if v.NewTask != nil {
			intent := domain.TaskIntent{Request: v.NewTask.Request, InitialScope: v.NewTask.InitialScope, InitialOutOfScope: v.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: v.NewTask.KnownAcceptanceCriteria, VerificationBudget: v.NewTask.VerificationBudget, MethodProfile: v.NewTask.MethodProfile}
			if intent.Validate() != nil {
				return domain.ErrInvalidArgument
			}
		}
		return nil
	case ToolGetTask, ToolGetNextAction:
		if !hasKeys(raw, "host", "task_id") {
			return domain.ErrInvalidArgument
		}
		var v readWire
		if decodeClosed(raw, &v) != nil || !v.Host.IsValid() || !v.TaskID.IsValid() || !validOperationProbe(v.OperationProbe) {
			return domain.ErrInvalidArgument
		}
		return nil
	case ToolApplyAction:
		// This boundary runs before the application service, so every failure it
		// reports is a proven zero-write failure.
		if missing := missingRequestMembers(raw, "request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"); len(missing) != 0 {
			return domain.InvalidArgumentViolations(missing...)
		}
		var v applyWire
		if err := decodeClosed(raw, &v); err != nil {
			if member, ok := unknownRequestMember(raw, "request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload", "recovery_apply"); ok {
				return domain.InvalidArgumentViolations(domain.Violation(member, domain.RuleUnknownMember))
			}
			return domain.ErrInvalidArgument
		}
		// The payload branch is fixed by the source cursor, so a mismatched
		// action_kind is reported as its own member before the composite identity
		// gate hides it behind a generic refusal.
		if v.ActionKind.IsValid() && (v.SourceCursor.Normal() || v.SourceCursor == domain.NodeBlocked) {
			if node, err := workflow.NodeDefinition(workflow.StandardProcess(), v.SourceCursor); err == nil && node.ActionKind != v.ActionKind {
				return domain.InvalidArgumentViolations(domain.Violation("action_kind", domain.RuleActionKindPayloadMismatch))
			}
		}
		if !v.RequestID.IsValid() || !v.Host.IsValid() || !v.TaskID.IsValid() || v.Revision == 0 || !v.ActionID.IsValid() || !v.ActionKind.IsValid() || v.ProcessID != domain.ProcessStandardDevelopment || !v.ProcessDefinitionDigest.IsValid() || (!v.SourceCursor.Normal() && v.SourceCursor != domain.NodeBlocked) || !v.RepositoryBindingDigest.IsValid() || len(v.Payload) == 0 || !validRecoveryApply(v.RecoveryApply, v.SourceCursor, v.RequestID) || v.RecoveryApply == nil && bytes.Equal(bytes.TrimSpace(v.Payload), []byte("null")) {
			return domain.ErrInvalidArgument
		}
		if !bytes.Equal(bytes.TrimSpace(v.Payload), []byte("null")) {
			var err error
			if v.SourceCursor == domain.NodeBlocked {
				_, _, err = recovery.DecodeBlockerResolutionPayload(v.Payload)
			} else {
				err = workflow.ValidateRetainedPayload(v.SourceCursor, v.Payload)
			}
			if err != nil {
				if errors.Is(err, domain.ErrTransitionNotAllowed) || errors.Is(err, domain.ErrInvalidArgument) {
					return err
				}
				return domain.ErrInvalidArgument
			}
		}
		return nil
	case ToolCancelTask:
		if !hasKeys(raw, "request_id", "host", "task_id", "revision", "reason") {
			return domain.ErrInvalidArgument
		}
		var v cancelWire
		if decodeClosed(raw, &v) != nil || !v.RequestID.IsValid() || !v.Host.IsValid() || !v.TaskID.IsValid() || v.Revision == 0 || !utf8.ValidString(v.Reason) || strings.TrimSpace(v.Reason) == "" || v.Reason != strings.TrimSpace(v.Reason) || len(v.Reason) > domain.MaxReasonBytes {
			return domain.ErrInvalidArgument
		}
		return nil
	case ToolResolveBlocker, ToolRecoverAction:
		if !hasKeys(raw, "host", "task_id", "action_id") {
			return domain.ErrInvalidArgument
		}
		var v actionReferenceWire
		if decodeClosed(raw, &v) != nil || !v.Host.IsValid() || !v.TaskID.IsValid() || !v.ActionID.IsValid() {
			return domain.ErrInvalidArgument
		}
		return nil
	default:
		return domain.ErrInvalidArgument
	}
}

func validateSubmitActionInput(kind domain.ActionKind, raw []byte) error {
	if missing := missingRequestMembers(raw, "host", "task_id", "action_id", "transition_id", "summary", "reason", "artifacts", "method_results", "node_result"); len(missing) != 0 {
		return domain.InvalidArgumentViolations(missing...)
	}
	var value submitActionWire
	if err := decodeClosed(raw, &value); err != nil {
		if member, ok := unknownRequestMember(raw, "host", "task_id", "action_id", "transition_id", "summary", "reason", "artifacts", "method_results", "node_result"); ok {
			return domain.InvalidArgumentViolations(domain.Violation(member, domain.RuleUnknownMember))
		}
		return domain.ErrInvalidArgument
	}
	if !value.Host.IsValid() || !value.TaskID.IsValid() || !value.ActionID.IsValid() ||
		!value.TransitionID.IsValid() || len(value.NodeResult) == 0 || !json.Valid(value.NodeResult) ||
		len(value.Artifacts.Current)+len(value.Artifacts.OtherProcess) > domain.MaxArtifactReferencesPerAction ||
		len(value.MethodResults) > domain.MaxMethodEvidencePerAction {
		return domain.ErrInvalidArgument
	}
	node, err := workflow.NodeDefinitionForActionKind(workflow.StandardProcess(), kind)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	if _, err := workflow.TransitionFor(workflow.StandardProcess(), node.NodeID, value.TransitionID); err != nil {
		return domain.ErrTransitionNotAllowed
	}
	if _, allowed := workflow.PrimaryArtifactRoleForNode(node.NodeID); !allowed && len(value.Artifacts.Current) != 0 {
		return domain.InvalidArgumentViolations(domain.Violation("artifacts.current", domain.RuleArtifactRoleNotAllowed))
	}
	return nil
}
func validOperationProbe(v *operationProbeWire) bool {
	if v == nil {
		return true
	}
	operation := domain.OperationReference{OperationID: v.OperationID, Process: domain.ProcessReference{ID: v.ProcessID, DefinitionDigest: v.ProcessDefinitionDigest}, SourceCursor: v.SourceCursor, ExpectedRevision: v.ExpectedRevision, ActionID: v.ActionID, ActionKind: v.ActionKind, RepositoryBindingDigest: v.RepositoryBindingDigest}
	if workflow.ValidateOperationReference(operation) != nil || len(v.Payload) == 0 {
		return false
	}
	if bytes.Equal(bytes.TrimSpace(v.Payload), []byte("null")) {
		return true
	}
	if v.SourceCursor == domain.NodeBlocked {
		_, _, err := recovery.DecodeBlockerResolutionPayload(v.Payload)
		return err == nil
	}
	return workflow.ValidateRetainedPayload(v.SourceCursor, v.Payload) == nil
}
func validRecoveryApply(v *recoveryApplyWire, source domain.NodeID, requestID domain.ID) bool {
	return v == nil || v.OperationID == requestID && v.SourceCursor == source && (source.Normal() || source == domain.NodeBlocked)
}

// missingRequestMembers names every required top-level request member that the
// caller omitted.
func missingRequestMembers(raw []byte, keys ...string) []domain.ContractViolation {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return nil
	}
	var out []domain.ContractViolation
	for _, key := range keys {
		if _, present := value[key]; !present {
			out = append(out, domain.Violation(key, domain.RuleRequiredMemberMissing))
		}
	}
	return out
}

// unknownRequestMember names the first submitted top-level member the closed
// request contract does not declare.
func unknownRequestMember(raw []byte, declared ...string) (string, bool) {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return "", false
	}
	known := make(map[string]bool, len(declared))
	for _, key := range declared {
		known[key] = true
	}
	names := make([]string, 0, len(value))
	for name := range value {
		if !known[name] && domain.ValidViolationPath(name) {
			names = append(names, name)
		}
	}
	if len(names) == 0 {
		return "", false
	}
	sort.Strings(names)
	return names[0], true
}
func hasKeys(raw []byte, keys ...string) bool {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	for _, key := range keys {
		if _, ok := value[key]; !ok {
			return false
		}
	}
	return true
}
func nullField(raw []byte, key string) bool {
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	field, ok := value[key]
	return ok && bytes.Equal(bytes.TrimSpace(field), []byte("null"))
}
func toOpen(w openWire, id domain.ID) application.OpenTaskRequest {
	r := application.OpenTaskRequest{RequestID: id, Host: w.Host, RepositoryPath: w.RepositoryPath, PrimaryRepositoryKey: w.PrimaryRepositoryKey}
	if len(w.AdditionalRepositories) != 0 {
		r.AdditionalRepositories = make([]application.AdditionalRepositoryInput, len(w.AdditionalRepositories))
		for i, repository := range w.AdditionalRepositories {
			r.AdditionalRepositories[i] = application.AdditionalRepositoryInput{Key: repository.Key, RepositoryPath: repository.RepositoryPath}
		}
	}
	if w.NewTask != nil {
		r.NewTask = &application.NewTaskInput{Request: w.NewTask.Request, InitialScope: w.NewTask.InitialScope, InitialOutOfScope: w.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: w.NewTask.KnownAcceptanceCriteria, VerificationBudget: w.NewTask.VerificationBudget, MethodProfile: w.NewTask.MethodProfile}
	}
	return r
}
func validRepositoryPath(path string) bool {
	return path != "" && len(path) <= domain.MaxRepositoryPathBytes && utf8.ValidString(path)
}
func toProbe(w *operationProbeWire) *application.OperationProbe {
	if w == nil {
		return nil
	}
	return &application.OperationProbe{OperationID: w.OperationID, ProcessID: w.ProcessID, ProcessDefinitionDigest: w.ProcessDefinitionDigest, SourceCursor: w.SourceCursor, ExpectedRevision: w.ExpectedRevision, ActionID: w.ActionID, ActionKind: w.ActionKind, RepositoryBindingDigest: w.RepositoryBindingDigest, Payload: w.Payload}
}
func toRecoveryApply(w *recoveryApplyWire) *application.RecoveryApplyInput {
	if w == nil {
		return nil
	}
	return &application.RecoveryApplyInput{OperationID: w.OperationID, SourceCursor: w.SourceCursor}
}

func toSubmitAction(w submitActionWire, requestID domain.ID, kind domain.ActionKind) application.SubmitActionRequest {
	current := make([]application.ArtifactSubmission, len(w.Artifacts.Current))
	for index, item := range w.Artifacts.Current {
		current[index] = application.ArtifactSubmission{Path: item.Path, Digest: item.Digest, Summary: item.Summary}
	}
	other := make([]application.ArtifactSubmission, len(w.Artifacts.OtherProcess))
	for index, item := range w.Artifacts.OtherProcess {
		other[index] = application.ArtifactSubmission{Path: item.Path, Digest: item.Digest, Summary: item.Summary}
	}
	methods := make(map[domain.MethodStepID]application.MethodResultSubmission, len(w.MethodResults))
	for step, result := range w.MethodResults {
		methods[step] = application.MethodResultSubmission{Capability: result.Capability, Summary: result.Summary}
	}
	return application.SubmitActionRequest{
		RequestID: requestID, Host: w.Host, TaskID: w.TaskID, ActionID: w.ActionID, ExpectedActionKind: kind,
		TransitionID: w.TransitionID, Summary: w.Summary, Reason: w.Reason, CurrentArtifacts: current,
		OtherProcessArtifacts: other, MethodResults: methods, NodeResult: append(json.RawMessage(nil), w.NodeResult...),
	}
}
