package mcp

import (
	"encoding/json"
	"io"
	"sync"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

const maxDiagnosticEventBytes = 64

type Diagnostics struct {
	mu     sync.Mutex
	writer io.Writer
	now    func() time.Time
}

type diagnosticEvent struct {
	Timestamp time.Time        `json:"timestamp"`
	Level     string           `json:"level"`
	RequestID string           `json:"request_id"`
	Tool      string           `json:"tool"`
	Code      domain.ErrorCode `json:"code,omitempty"`
	Event     string           `json:"event"`
}

func NewDiagnostics(writer io.Writer) *Diagnostics {
	if writer == nil {
		writer = io.Discard
	}
	return &Diagnostics{writer: writer, now: time.Now}
}

func (diagnostics *Diagnostics) completed(requestID, tool string) {
	diagnostics.write("info", requestID, tool, "", "tool_call_completed")
}

func (diagnostics *Diagnostics) failed(requestID, tool string, code domain.ErrorCode) {
	diagnostics.write("error", requestID, tool, code, "tool_call_failed")
}

func (diagnostics *Diagnostics) write(level, requestID, tool string, code domain.ErrorCode, event string) {
	if diagnostics == nil {
		return
	}
	if len(event) == 0 || len(event) > maxDiagnosticEventBytes {
		event = "diagnostic_event"
	}
	entry := diagnosticEvent{
		Timestamp: diagnostics.now().UTC(),
		Level:     level,
		RequestID: requestID,
		Tool:      tool,
		Code:      code,
		Event:     event,
	}
	diagnostics.mu.Lock()
	defer diagnostics.mu.Unlock()
	encoder := json.NewEncoder(diagnostics.writer)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(entry)
}
