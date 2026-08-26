import { ActionView, Fact } from "../lib/api";
import { ActionPanel } from "./ActionPanel";
import { useI18n } from "../lib/i18n";

export function BlockerPanel({ taskID, revision, action, blocker, disabled, onChanged }: { taskID: string; revision: number; action: ActionView; blocker: Fact; disabled: boolean; onChanged: () => void }) {
  const { t } = useI18n();
  return <div className="blocker-panel"><div className="notice warning"><strong>{t("blocker.title")}</strong> {t("blocker.body")}</div><details open><summary>{blocker.label}</summary><pre>{format(blocker.value)}</pre></details><ActionPanel taskID={taskID} revision={revision} action={action} disabled={disabled} onChanged={onChanged} /></div>;
}

function format(value: string): string { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
