import { ActionView, Fact } from "../lib/api";
import { ActionPanel } from "./ActionPanel";
import { useI18n } from "../lib/i18n";

export function BlockerPanel({ taskID, revision, action, blocker, disabled, onChanged }: { taskID: string; revision: number; action: ActionView; blocker: Fact; disabled: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  return <div className="blocker-panel"><div className="notice warning"><strong>{t("blocker.title")}</strong> {t("blocker.body")}</div><details open><summary>{blocker.label}</summary><pre>{format(blocker.value)}</pre></details><ActionPanel taskID={taskID} revision={revision} action={action} disabled={disabled} onChanged={onChanged} initialPayload={blockerPayload(blocker.value)} /></div>;
}

function format(value: string): string { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }

function blockerPayload(value: string): Record<string, unknown> | undefined {
  try {
    const blocker = JSON.parse(value) as { blocker_id?: unknown; condition?: unknown; observed_binding_digest?: unknown; cause?: unknown };
    if (typeof blocker.blocker_id !== "string" || typeof blocker.observed_binding_digest !== "string" || typeof blocker.condition !== "object" || blocker.condition === null) return undefined;
    return {
      blocker_id: blocker.blocker_id,
      condition: blocker.condition,
      observed_binding_digest: blocker.observed_binding_digest,
      ...(blocker.cause === "file_scope_decision" ? { file_scope_decision: { choice: "allow_once", reason: "" } } : {}),
    };
  } catch { return undefined; }
}
