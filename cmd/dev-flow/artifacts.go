package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"path/filepath"
	"time"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func decodeArtifactInput(raw []byte, target any) error {
	trimmed := bytes.TrimSpace(raw)
	if !utf8.Valid(raw) || len(trimmed) == 0 || trimmed[0] != '{' {
		return domain.ErrInvalidArgument
	}
	tokens := json.NewDecoder(bytes.NewReader(raw))
	if err := artifactJSONValue(tokens); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing any
	if decoder.Decode(&trailing) != io.EOF {
		return domain.ErrInvalidArgument
	}
	return nil
}

// artifactJSONValue rejects duplicate keys before decoding a closed command DTO.
func artifactJSONValue(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, compound := token.(json.Delim)
	if !compound {
		return nil
	}
	if delim != '{' && delim != '[' {
		return domain.ErrInvalidArgument
	}
	seen := map[string]bool{}
	for decoder.More() {
		if delim == '{' {
			key, err := decoder.Token()
			if err != nil {
				return err
			}
			name, ok := key.(string)
			if !ok || seen[name] {
				return domain.ErrInvalidArgument
			}
			seen[name] = true
		}
		if err := artifactJSONValue(decoder); err != nil {
			return err
		}
	}
	_, err = decoder.Token()
	return err
}

type artifactCommandFailure struct {
	Code            domain.ErrorCode           `json:"code"`
	Message         string                     `json:"message"`
	Details         []domain.ContractViolation `json:"details,omitempty"`
	RepositoryPaths []string                   `json:"repository_paths,omitempty"`
}

func runArtifacts(command string, stdin io.Reader, stdout, stderr io.Writer, getenv func(string) string) int {
	if stdin == nil || stdout == nil || stderr == nil || getenv == nil {
		return 1
	}
	fail := func(err error) int {
		failure := artifactCommandFailure{Code: domain.ErrorInternal, Message: "Artifact preparation failed."}
		var typed *domain.Error
		if errors.As(err, &typed) {
			failure.Code, failure.Message, failure.Details = typed.Code, typed.Message, typed.Violations
			failure.RepositoryPaths = domain.ViolationRepositoryPaths(err)
		}
		_ = json.NewEncoder(stdout).Encode(struct {
			OK    bool                   `json:"ok"`
			Error artifactCommandFailure `json:"error"`
		}{false, failure})
		return 1
	}
	// Closed JSON parsing also rejects duplicate members and malformed UTF-8.
	raw, err := io.ReadAll(io.LimitReader(stdin, 1024*1024+1))
	if err != nil || len(raw) > 1024*1024 || !json.Valid(raw) {
		return fail(domain.ErrInvalidArgument)
	}
	var collect application.CollectArtifactsRequest
	var prepare application.PrepareArtifactsRequest
	var target any = &collect
	if command == "prepare" {
		target = &prepare
	}
	if err := decodeArtifactInput(raw, target); err != nil {
		return fail(domain.ErrInvalidArgument)
	}
	dataDirectory := getenv(dataDirectoryEnvironment)
	if !usableDataDirectory(dataDirectory) {
		return fail(domain.ErrStorageUnavailable)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := store.OpenReadOnly(ctx, filepath.Join(dataDirectory, databaseFileName))
	if err != nil {
		return fail(domain.ErrStorageUnavailable)
	}
	defer db.Close()
	service, err := application.NewService(db, repository.NewGitObserver())
	if err != nil {
		return fail(err)
	}
	var result any
	if command == "collect" {
		result, err = service.CollectArtifacts(ctx, collect)
	} else {
		result, err = service.PrepareArtifacts(ctx, prepare)
	}
	if err != nil {
		return fail(err)
	}
	if json.NewEncoder(stdout).Encode(struct {
		OK     bool `json:"ok"`
		Result any  `json:"result"`
	}{true, result}) != nil {
		return 1
	}
	return 0
}
