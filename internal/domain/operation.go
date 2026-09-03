package domain

import "time"

// OperationReference identifies the exact graph action whose result is uncertain.
type OperationReference struct {
	OperationID             ID               `json:"operation_id"`
	Process                 ProcessReference `json:"process"`
	SourceCursor            NodeID           `json:"source_cursor"`
	ExpectedRevision        uint64           `json:"expected_revision"`
	ActionID                ID               `json:"action_id"`
	ActionKind              ActionKind       `json:"action_kind"`
	RepositoryBindingDigest Digest           `json:"repository_binding_digest"`
	IssuanceIdentityDigest  Digest           `json:"issuance_identity_digest"`
	IssuanceHistoryDigest   Digest           `json:"issuance_history_digest"`
	IssuanceContentDigest   Digest           `json:"issuance_content_digest"`
}

func (o OperationReference) Validate() error {
	if !o.OperationID.IsValid() || o.Process.Validate() != nil ||
		(!o.SourceCursor.Normal() && o.SourceCursor != NodeBlocked) ||
		o.ExpectedRevision == 0 || !o.ActionID.IsValid() || !o.ActionKind.IsValid() ||
		!o.RepositoryBindingDigest.IsValid() || !o.IssuanceIdentityDigest.IsValid() ||
		!o.IssuanceHistoryDigest.IsValid() || !o.IssuanceContentDigest.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

// TaskRelocation retains the exact source state while the Host moves the Task.
type TaskRelocation struct {
	RelocationID         ID        `json:"relocation_id"`
	SourceBindingDigest  Digest    `json:"source_binding_digest"`
	SourceIdentityDigest Digest    `json:"source_identity_digest"`
	SourceHistoryDigest  Digest    `json:"source_history_digest"`
	SourceContentDigest  Digest    `json:"source_content_digest"`
	SourceTaskSurface    []string  `json:"source_task_surface"`
	ResumeNode           NodeID    `json:"resume_node"`
	PreparedAt           time.Time `json:"prepared_at"`
}

func (r TaskRelocation) Validate() error {
	if !r.RelocationID.IsValid() || !r.SourceBindingDigest.IsValid() || !r.SourceIdentityDigest.IsValid() ||
		!r.SourceHistoryDigest.IsValid() || !r.SourceContentDigest.IsValid() || !r.ResumeNode.Normal() ||
		validateUTC(r.PreparedAt) != nil || len(r.SourceTaskSurface) > MaxFingerprintPaths {
		return ErrInvalidArgument
	}
	for index, path := range r.SourceTaskSurface {
		if ValidateRepositoryContractPath(path) != nil || index > 0 && r.SourceTaskSurface[index-1] >= path {
			return ErrInvalidArgument
		}
	}
	return nil
}
