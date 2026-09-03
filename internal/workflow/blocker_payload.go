package workflow

import (
	"bytes"
	"encoding/json"
	"io"
	"path/filepath"

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
	switch payload.Condition.Kind {
	case domain.BlockerConditionResolveFileScope:
		if payload.FileScopeDecision == nil || payload.HistoryResolution != nil || payload.RelocationID != "" || len(payload.RelocationDestinations) != 0 {
			return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
		}
	case domain.BlockerConditionResolveHistory:
		if payload.HistoryResolution == nil || payload.HistoryResolution.Validate() != nil || payload.FileScopeDecision != nil || payload.RelocationID != "" || len(payload.RelocationDestinations) != 0 {
			return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
		}
	case domain.BlockerConditionResolveRelocation:
		if payload.RelocationID != payload.Condition.RelocationID || len(payload.RelocationDestinations) == 0 || len(payload.RelocationDestinations) > domain.MaxRepositoryScopeEntries || payload.FileScopeDecision != nil || payload.HistoryResolution != nil {
			return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
		}
		seen := map[domain.RepositoryKey]bool{}
		for _, destination := range payload.RelocationDestinations {
			if !destination.Key.IsValid() || seen[destination.Key] || destination.RepositoryPath == "" || !filepath.IsAbs(destination.RepositoryPath) || filepath.Clean(destination.RepositoryPath) != destination.RepositoryPath {
				return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
			}
			seen[destination.Key] = true
		}
	default:
		if payload.FileScopeDecision != nil || payload.HistoryResolution != nil || payload.RelocationID != "" || len(payload.RelocationDestinations) != 0 {
			return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
		}
	}
	canonical, err := json.Marshal(payload)
	if err != nil {
		return domain.BlockerResolutionPayload{}, nil, domain.ErrInvalidArgument
	}
	return payload, canonical, nil
}
