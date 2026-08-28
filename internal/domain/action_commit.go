package domain

import (
	"bytes"
	"encoding/json"
	"time"
	"unicode/utf8"
)

// ActionCommit is the immutable canonical input retained for one recoverable
// Action operation.
type ActionCommit struct {
	Operation     OperationReference `json:"operation"`
	Payload       json.RawMessage    `json:"payload"`
	PayloadDigest Digest             `json:"payload_digest"`
	PreparedAt    time.Time          `json:"prepared_at"`
}

func (c ActionCommit) Validate() error {
	if c.Operation.Validate() != nil || len(c.Payload) == 0 || len(c.Payload) > MaxActionPayloadBytes ||
		!utf8.Valid(c.Payload) || !json.Valid(c.Payload) || bytes.Equal(bytes.TrimSpace(c.Payload), []byte("null")) ||
		!c.PayloadDigest.IsValid() || validateUTC(c.PreparedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (c ActionCommit) Equal(other ActionCommit) bool {
	return c.Operation == other.Operation && c.PayloadDigest == other.PayloadDigest &&
		c.PreparedAt.Equal(other.PreparedAt) && bytes.Equal(c.Payload, other.Payload)
}

func (c ActionCommit) Clone() ActionCommit {
	c.Payload = append(json.RawMessage(nil), c.Payload...)
	return c
}
