package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type persistedTask domain.ProcessTask

func encodeTask(task domain.ProcessTask) ([]byte, error) {
	if err := workflow.ValidateProcessTask(task); err != nil {
		return nil, ErrInvalidArgument
	}
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(persistedTask(task)); err != nil {
		return nil, ErrInvalidArgument
	}
	raw := bytes.TrimSuffix(b.Bytes(), []byte("\n"))
	if len(raw) > domain.MaxPersistedTaskSnapshotBytes {
		return nil, ErrInvalidArgument
	}
	return append([]byte(nil), raw...), nil
}
func decodeTask(raw []byte) (domain.ProcessTask, error) {
	if len(raw) == 0 || len(raw) > domain.MaxPersistedTaskSnapshotBytes || !utf8.Valid(raw) || rejectDuplicateJSON(raw) != nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	var dto persistedTask
	if err := d.Decode(&dto); err != nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	var trailing any
	if err := d.Decode(&trailing); err != io.EOF {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	task := domain.ProcessTask(dto)
	if err := workflow.ValidateProcessTask(task); err != nil {
		return domain.ProcessTask{}, ErrStorageUnavailable
	}
	return task, nil
}
func rejectDuplicateJSON(raw []byte) error {
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
