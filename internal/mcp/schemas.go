package mcp

import "encoding/json"

const (
	ToolServerInfo    = "dev_flow_server_info"
	ToolOpenTask      = "dev_flow_open_task"
	ToolGetTask       = "dev_flow_get_task"
	ToolGetNextAction = "dev_flow_get_next_action"
	ToolApplyAction   = "dev_flow_apply_action"
	ToolCancelTask    = "dev_flow_cancel_task"
)

type ToolAnnotations struct{ ReadOnly, Destructive, Idempotent, OpenWorld bool }
type ToolDefinition struct {
	Name, Description string
	InputSchema       json.RawMessage
	Annotations       ToolAnnotations
}

var catalog = []ToolDefinition{{ToolServerInfo, "Read Core Contract 0.2 server identity.", json.RawMessage(`{"type":"object","additionalProperties":false,"properties":{}}`), ToolAnnotations{ReadOnly: true}}, {ToolOpenTask, "Open or resume one graph task.", json.RawMessage(`{"type":"object","additionalProperties":false,"required":["host","repository_path"],"properties":{"host":{"enum":["codex","deepseek"]},"repository_path":{"type":"string"},"new_task":{"type":["object","null"]}}}`), ToolAnnotations{}}, {ToolGetTask, "Read one graph task.", json.RawMessage(`{"type":"object","additionalProperties":false,"required":["host","task_id"],"properties":{"host":{"enum":["codex","deepseek"]},"task_id":{"type":"string"}}}`), ToolAnnotations{ReadOnly: true}}, {ToolGetNextAction, "Read the persisted graph action.", json.RawMessage(`{"type":"object","additionalProperties":false,"required":["host","task_id"],"properties":{"host":{"enum":["codex","deepseek"]},"task_id":{"type":"string"}}}`), ToolAnnotations{ReadOnly: true}}, {ToolApplyAction, "Apply one Core-declared transition.", json.RawMessage(`{"type":"object","additionalProperties":false,"required":["request_id","host","task_id","revision","action_id","action_kind","process_definition_digest","repository_binding_digest","payload"],"properties":{"request_id":{"type":"string"},"host":{"enum":["codex","deepseek"]},"task_id":{"type":"string"},"revision":{"type":"integer"},"action_id":{"type":"string"},"action_kind":{"type":"string"},"process_definition_digest":{"type":"string"},"repository_binding_digest":{"type":"string"},"payload":{"type":"object"}}}`), ToolAnnotations{}}, {ToolCancelTask, "Cancel one graph task.", json.RawMessage(`{"type":"object","additionalProperties":false,"required":["host","task_id","revision","reason"],"properties":{"host":{"enum":["codex","deepseek"]},"task_id":{"type":"string"},"revision":{"type":"integer"},"reason":{"type":"string"}}}`), ToolAnnotations{Destructive: true}}}

func ToolCatalog() []ToolDefinition { return append([]ToolDefinition(nil), catalog...) }
func ToolNames() []string {
	out := make([]string, len(catalog))
	for i, v := range catalog {
		out[i] = v.Name
	}
	return out
}
