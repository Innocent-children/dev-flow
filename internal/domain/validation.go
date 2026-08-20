package domain

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

func compactJSONSize(value any) (int, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return 0, ErrInvalidArgument
	}
	encoded := buffer.Bytes()
	if len(encoded) == 0 || encoded[len(encoded)-1] != '\n' {
		return 0, ErrInvalidArgument
	}
	return len(encoded) - 1, nil
}

func normalizeRequiredText(value string, maxBytes int) (string, error) {
	if !utf8.ValidString(value) {
		return "", ErrInvalidArgument
	}
	value = strings.TrimSpace(value)
	if value == "" || len(value) > maxBytes {
		return "", ErrInvalidArgument
	}
	return value, nil
}

func normalizeOptionalText(value string, maxBytes int) (string, error) {
	if !utf8.ValidString(value) {
		return "", ErrInvalidArgument
	}
	value = strings.TrimSpace(value)
	if len(value) > maxBytes {
		return "", ErrInvalidArgument
	}
	return value, nil
}

func requireNormalizedText(value string, maxBytes int, required bool) error {
	var normalized string
	var err error
	if required {
		normalized, err = normalizeRequiredText(value, maxBytes)
	} else {
		normalized, err = normalizeOptionalText(value, maxBytes)
	}
	if err != nil || normalized != value {
		return ErrInvalidArgument
	}
	return nil
}

func normalizeTextList(values []string, maxItems, maxItemBytes int, requireItems bool) ([]string, error) {
	if len(values) > maxItems || (requireItems && len(values) == 0) {
		return nil, ErrInvalidArgument
	}
	result := make([]string, len(values))
	seen := make(map[string]struct{}, len(values))
	for i, value := range values {
		normalized, err := normalizeRequiredText(value, maxItemBytes)
		if err != nil {
			return nil, err
		}
		if _, duplicate := seen[normalized]; duplicate {
			return nil, ErrInvalidArgument
		}
		seen[normalized] = struct{}{}
		result[i] = normalized
	}
	return result, nil
}

func validateNormalizedTextList(values []string, maxItems, maxItemBytes int, requireItems bool) error {
	normalized, err := normalizeTextList(values, maxItems, maxItemBytes, requireItems)
	if err != nil || len(normalized) != len(values) {
		return ErrInvalidArgument
	}
	for i := range values {
		if normalized[i] != values[i] {
			return ErrInvalidArgument
		}
	}
	return nil
}

func validateID(value ID) error {
	text := string(value)
	if !utf8.ValidString(text) || text == "" || len(text) > MaxIdentifierBytes ||
		text != strings.TrimSpace(text) || strings.IndexFunc(text, unicode.IsSpace) >= 0 {
		return ErrInvalidArgument
	}
	return nil
}

func validateDigest(value Digest) error {
	text := string(value)
	if len(text) != sha256.Size*2 || strings.ToLower(text) != text {
		return ErrInvalidArgument
	}
	decoded, err := hex.DecodeString(text)
	if err != nil || len(decoded) != sha256.Size {
		return ErrInvalidArgument
	}
	return nil
}

func validateObjectID(value string) error {
	if len(value) != 40 && len(value) != 64 {
		return ErrInvalidArgument
	}
	if strings.ToLower(value) != value {
		return ErrInvalidArgument
	}
	_, err := hex.DecodeString(value)
	if err != nil {
		return ErrInvalidArgument
	}
	return nil
}

func validateUTC(value time.Time) error {
	if value.IsZero() {
		return ErrInvalidArgument
	}
	_, offset := value.Zone()
	if offset != 0 {
		return ErrInvalidArgument
	}
	return nil
}

func validateCanonicalPath(value string) error {
	if !utf8.ValidString(value) || value == "" || len(value) > MaxRepositoryPathBytes ||
		!filepath.IsAbs(value) || filepath.Clean(value) != value {
		return ErrInvalidArgument
	}
	return nil
}

func cloneStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneIDPointer(value *ID) *ID {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
