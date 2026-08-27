package domain

import (
	"bytes"
	"encoding/json"
	"time"
	"unicode/utf8"
)

// ActionCommit retains the last canonical Action submission so Core can
// reconcile an uncertain response without asking the Host to rebuild it.
type ActionCommit struct {
	Operation     OperationReference `json:"operation"`
	Payload       json.RawMessage    `json:"payload"`
	PayloadDigest Digest             `json:"payload_digest"`
	PreparedAt    time.Time          `json:"prepared_at"`
}

func (c ActionCommit) Validate() error {
	if c.Operation.Validate() != nil || len(c.Payload) == 0 || len(c.Payload) > MaxActionPayloadBytes ||
		!utf8.Valid(c.Payload) || !json.Valid(c.Payload) || bytes.Equal(bytes.TrimSpace(c.Payload), []byte("null")) ||
		!c.PayloadDigest.IsValid() || validateUTC(c.PreparedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (c ActionCommit) Equal(other ActionCommit) bool {
	return c.Operation == other.Operation && c.PayloadDigest == other.PayloadDigest &&
		c.PreparedAt.Equal(other.PreparedAt) && bytes.Equal(c.Payload, other.Payload)
}

func actionCommitMatchesTask(task ProcessTask) bool {
	commit := task.ActionCommit
	if commit == nil || commit.Validate() != nil || commit.Operation.Process != task.Process {
		return commit == nil
	}
	operation := commit.Operation
	if task.CurrentAction != nil && task.Revision == operation.ExpectedRevision &&
		task.CurrentNode == operation.SourceCursor && task.CurrentAction.ActionID == operation.ActionID &&
		task.CurrentAction.Kind == operation.ActionKind && task.CurrentAction.RepositoryBindingDigest == operation.RepositoryBindingDigest {
		return true
	}
	last := task.LastOperation
	return last != nil && last.Kind == OperationApplyAction && last.ActionID != nil &&
		last.OperationID == operation.OperationID && *last.ActionID == operation.ActionID &&
		last.FromRevision == operation.ExpectedRevision && last.ToRevision == task.Revision &&
		last.PayloadDigest == commit.PayloadDigest
}
