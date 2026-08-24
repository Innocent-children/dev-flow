package userconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"unicode/utf8"
)

const MaxConfigBytes = 16 * 1024

type HostPreferences struct {
	CodebaseMemory bool `json:"codebase_memory"`
}

type Preferences struct {
	Codex    HostPreferences `json:"codex"`
	DeepSeek HostPreferences `json:"deepseek"`
}

func Load(homeDirectory string) (Preferences, error) {
	if homeDirectory == "" {
		return Preferences{}, fmt.Errorf("user configuration: HOME is unavailable")
	}
	path := filepath.Join(homeDirectory, ".dev-flow", "config.json")
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Preferences{}, nil
		}
		return Preferences{}, fmt.Errorf("user configuration %q: read failed", path)
	}
	defer file.Close()

	raw, err := io.ReadAll(io.LimitReader(file, MaxConfigBytes+1))
	if err != nil {
		return Preferences{}, fmt.Errorf("user configuration %q: read failed", path)
	}
	if len(raw) > MaxConfigBytes {
		return Preferences{}, fmt.Errorf("user configuration %q: exceeds 16 KiB", path)
	}
	preferences, err := decode(raw)
	if err != nil {
		return Preferences{}, fmt.Errorf("user configuration %q: %w", path, err)
	}
	return preferences, nil
}

func decode(raw []byte) (Preferences, error) {
	if !utf8.Valid(raw) {
		return Preferences{}, fmt.Errorf("invalid UTF-8")
	}
	if duplicate, err := duplicateMember(raw); err != nil {
		return Preferences{}, fmt.Errorf("invalid JSON")
	} else if duplicate != "" {
		return Preferences{}, fmt.Errorf("duplicate field %q", duplicate)
	}

	var root map[string]json.RawMessage
	if err := decodeSingle(raw, &root); err != nil {
		if err.Error() == "trailing JSON" {
			return Preferences{}, err
		}
		return Preferences{}, fmt.Errorf("invalid JSON")
	}
	if root == nil {
		return Preferences{}, fmt.Errorf("top level must be an object")
	}
	preferences := Preferences{}
	for name, value := range root {
		var destination *HostPreferences
		switch name {
		case "codex":
			destination = &preferences.Codex
		case "deepseek":
			destination = &preferences.DeepSeek
		default:
			return Preferences{}, fmt.Errorf("unknown top-level field %q", name)
		}
		if err := decodeHost(name, value, destination); err != nil {
			return Preferences{}, err
		}
	}
	return preferences, nil
}

func decodeHost(name string, raw json.RawMessage, destination *HostPreferences) error {
	var object map[string]json.RawMessage
	if err := decodeSingle(raw, &object); err != nil || object == nil {
		return fmt.Errorf("field %q must be an object", name)
	}
	for field, value := range object {
		if field != "codebase_memory" {
			return fmt.Errorf("unknown field %q", name+"."+field)
		}
		var decoded any
		if err := decodeSingle(value, &decoded); err != nil {
			return fmt.Errorf("field %q must be a boolean", name+".codebase_memory")
		}
		preference, ok := decoded.(bool)
		if !ok {
			return fmt.Errorf("field %q must be a boolean", name+".codebase_memory")
		}
		destination.CodebaseMemory = preference
	}
	return nil
}

func decodeSingle(raw []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("trailing JSON")
	}
	return nil
}

func duplicateMember(raw []byte) (string, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	var walk func() (string, error)
	walk = func() (string, error) {
		token, err := decoder.Token()
		if err != nil {
			return "", err
		}
		delimiter, ok := token.(json.Delim)
		if !ok {
			return "", nil
		}
		switch delimiter {
		case '{':
			seen := map[string]bool{}
			for decoder.More() {
				keyToken, err := decoder.Token()
				if err != nil {
					return "", err
				}
				key, ok := keyToken.(string)
				if !ok {
					return "", fmt.Errorf("invalid object member")
				}
				if seen[key] {
					return key, nil
				}
				seen[key] = true
				if duplicate, err := walk(); err != nil || duplicate != "" {
					return duplicate, err
				}
			}
			_, err = decoder.Token()
			return "", err
		case '[':
			for decoder.More() {
				if duplicate, err := walk(); err != nil || duplicate != "" {
					return duplicate, err
				}
			}
			_, err = decoder.Token()
			return "", err
		default:
			return "", fmt.Errorf("invalid JSON delimiter")
		}
	}
	return walk()
}
