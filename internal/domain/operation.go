package domain

// OperationReference identifies the exact graph action whose result is uncertain.
type OperationReference struct {
	OperationID             ID               `json:"operation_id"`
	Process                 ProcessReference `json:"process"`
	SourceCursor            NodeID           `json:"source_cursor"`
	ExpectedRevision        uint64           `json:"expected_revision"`
	ActionID                ID               `json:"action_id"`
	ActionKind              ActionKind       `json:"action_kind"`
	RepositoryBindingDigest Digest           `json:"repository_binding_digest"`
}

func (o OperationReference) Validate() error {
	if !o.OperationID.IsValid() || o.Process.Validate() != nil ||
		(!o.SourceCursor.Normal() && o.SourceCursor != NodeBlocked) ||
		o.ExpectedRevision == 0 || !o.ActionID.IsValid() || !o.ActionKind.IsValidV2() ||
		!o.RepositoryBindingDigest.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}
