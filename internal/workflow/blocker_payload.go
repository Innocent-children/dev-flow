package workflow

import (
	"bytes"
	"encoding/json"
	"io"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func DecodeBlockerResolutionPayload(raw []byte) (domain.BlockerResolutionPayload, json.RawMessage, error) {
	if len(raw) == 0 || !json.Valid(raw) || rejectDuplicateMembers(raw) != nil {
		return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var payload domain.BlockerResolutionPayload
	if decoder.Decode(&payload) != nil || decoder.Decode(&struct{}{}) != io.EOF ||
		!payload.BlockerID.IsValid() || payload.Condition.Validate() != nil || !payload.ObservedBindingDigest.IsValid() ||
		payload.FileScopeDecision != nil && payload.FileScopeDecision.Validate() != nil {
		return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	canonical, err := json.Marshal(payload)
	if err != nil {
		return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	return payload, canonical, nil
}
