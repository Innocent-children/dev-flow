package workflow

import (
	"bytes"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func ValidateActionCommit(task domain.ProcessTask) error {
	commit := task.ActionCommit
	if commit == nil {
		return nil
	}
	if commit.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	var canonical []byte
	var err error
	if commit.Operation.SourceCursor == domain.NodeBlocked {
		_, canonical, err = DecodeBlockerResolutionPayload(commit.Payload)
	} else {
		envelope, result, decodeErr := DecodeStandardPayload(commit.Operation.SourceCursor, commit.Payload)
		if decodeErr != nil {
			return domain.ErrInvalidArgument
		}
		node, nodeErr := NodeDefinition(StandardProcess(), commit.Operation.SourceCursor)
		if nodeErr != nil || ValidatePayload(StandardProcess(), commit.Operation.SourceCursor, envelope, result, node.SemanticMethodSteps) != nil {
			return domain.ErrInvalidArgument
		}
		canonical, err = CanonicalValidatedPayload(envelope, result)
	}
	if err != nil || !bytes.Equal(canonical, commit.Payload) {
		return domain.ErrInvalidArgument
	}
	digest, err := GraphOperationDigest(task.OriginHost, task.TaskID, commit.Operation, canonical)
	if err != nil || digest != commit.PayloadDigest {
		return domain.ErrInvalidArgument
	}
	return nil
}
