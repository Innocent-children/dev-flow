package workflow

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/Innocent-children/taskbelay/internal/domain"
)

func ValidateOperationReference(operation domain.OperationReference) error {
	if operation.Validate() != nil {
		return domain.WithExplanation(domain.ErrInvalidArgument, "The operation reference requires valid identities, a positive expected revision and all issuance workspace digests.")
	}
	definition := StandardProcess()
	if operation.Process != definition.Reference {
		return domain.WithExplanation(domain.ErrProcessUnsupported, "The operation process identity or definition digest differs from the supported process definition.")
	}
	node, err := NodeDefinition(definition, operation.SourceCursor)
	if err != nil || node.ActionKind != operation.ActionKind {
		return domain.WithExplanation(domain.ErrInvalidArgument, "The operation Action kind does not match its source node.")
	}
	return nil
}

func GraphOperationDigest(host domain.Host, taskID domain.ID, operation domain.OperationReference, canonicalPayload json.RawMessage) (domain.Digest, error) {
	if !host.IsValid() || !taskID.IsValid() || ValidateOperationReference(operation) != nil || len(canonicalPayload) == 0 {
		return "", domain.WithExplanation(domain.ErrInvalidArgument, "Computing an operation digest requires a supported host, valid Task and operation identities and a retained payload.")
	}
	value := struct {
		Host                    domain.Host       `json:"host"`
		TaskID                  domain.ID         `json:"task_id"`
		ExpectedRevision        uint64            `json:"expected_revision"`
		ActionID                domain.ID         `json:"action_id"`
		ActionKind              domain.ActionKind `json:"action_kind"`
		ProcessID               domain.ProcessID  `json:"process_id"`
		ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
		SourceCursor            domain.NodeID     `json:"source_cursor"`
		RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
		IssuanceIdentityDigest  domain.Digest     `json:"issuance_identity_digest"`
		IssuanceHistoryDigest   domain.Digest     `json:"issuance_history_digest"`
		IssuanceContentDigest   domain.Digest     `json:"issuance_content_digest"`
		Payload                 json.RawMessage   `json:"payload"`
	}{host, taskID, operation.ExpectedRevision, operation.ActionID, operation.ActionKind,
		operation.Process.ID, operation.Process.DefinitionDigest,
		operation.SourceCursor, operation.RepositoryBindingDigest, operation.IssuanceIdentityDigest,
		operation.IssuanceHistoryDigest, operation.IssuanceContentDigest, canonicalPayload}
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	raw := bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
	sum := sha256.Sum256(raw)
	return domain.Digest(hex.EncodeToString(sum[:])), nil
}
