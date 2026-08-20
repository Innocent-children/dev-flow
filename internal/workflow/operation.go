package workflow

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func ValidateOperationReference(operation domain.OperationReference) error {
	if operation.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	definition := StandardProcess()
	if operation.Process != definition.Reference {
		return domain.ErrProcessUnsupported
	}
	node, err := NodeDefinition(definition, operation.SourceCursor)
	if err != nil || node.ActionKind != operation.ActionKind {
		return domain.ErrInvalidArgument
	}
	return nil
}

func GraphOperationDigest(host domain.Host, taskID domain.ID, operation domain.OperationReference, canonicalPayload json.RawMessage) (domain.Digest, error) {
	if !host.IsValid() || !taskID.IsValid() || ValidateOperationReference(operation) != nil || len(canonicalPayload) == 0 {
		return "", domain.ErrInvalidArgument
	}
	value := struct {
		Host                    domain.Host       `json:"host"`
		TaskID                  domain.ID         `json:"task_id"`
		ExpectedRevision        uint64            `json:"expected_revision"`
		ActionID                domain.ID         `json:"action_id"`
		ActionKind              domain.ActionKind `json:"action_kind"`
		ProcessID               domain.ProcessID  `json:"process_id"`
		ProcessVersion          uint32            `json:"process_version"`
		ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
		SourceCursor            domain.NodeID     `json:"source_cursor"`
		RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
		Payload                 json.RawMessage   `json:"payload"`
	}{host, taskID, operation.ExpectedRevision, operation.ActionID, operation.ActionKind,
		operation.Process.ID, operation.Process.Version, operation.Process.DefinitionDigest,
		operation.SourceCursor, operation.RepositoryBindingDigest, canonicalPayload}
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
