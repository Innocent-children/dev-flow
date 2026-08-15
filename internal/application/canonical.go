package application

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func canonicalJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	encoded := buffer.Bytes()
	if len(encoded) == 0 || encoded[len(encoded)-1] != '\n' {
		return nil, domain.ErrInternal
	}
	return append([]byte(nil), encoded[:len(encoded)-1]...), nil
}

func digestCanonical(value any) (domain.Digest, error) {
	encoded, err := canonicalJSON(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return domain.Digest(hex.EncodeToString(digest[:])), nil
}
