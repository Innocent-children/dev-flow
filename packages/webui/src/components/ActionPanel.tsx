import { useEffect, useRef, useState } from "react";

import { ActionView, APIError, RecoveryAdvice, submitCurrentAction } from "../lib/api";
import { RecoveryPanel } from "./RecoveryPanel";
import { defaultValue, SchemaField } from "./SchemaField";
import { actionKindKey, useI18n } from "../lib/i18n";

export function ActionPanel({ taskID, revision, action, disabled, onChanged, pendingActionID }: { taskID: string; revision: number; action: ActionView; disabled: boolean; onChanged: () => void; pendingActionID: string | null }) {
  const { language, t } = useI18n();
  const [payload, setPayload] = useState<Record<string, unknown>>(() => asObject(defaultValue(action.payload_schema)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [details, setDetails] = useState<{ path: string; message: string }[]>([]);
  const [repositoryPaths, setRepositoryPaths] = useState<string[]>([]);
  const [guard, setGuard] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<{ actionID: string; advice?: RecoveryAdvice } | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const currentActionID = useRef(action.action_id);
  currentActionID.current = action.action_id;
  useEffect(() => { setPayload(asObject(defaultValue(action.payload_schema))); setError(""); setPaths([]); setDetails([]); setRepositoryPaths([]); setGuard(null); setUncertain(null); setBusy(false); }, [action.action_id]);
  useEffect(() => { setError(""); setPaths([]); setDetails([]); setRepositoryPaths([]); setGuard(null); }, [language]);
  const submit = async () => {
    const submittedActionID = action.action_id;
    const operationID = `action-${crypto.randomUUID()}`;
    setBusy(true); setError(""); setPaths([]); setDetails([]); setRepositoryPaths([]); setGuard(null); setUncertain(null);
    try { await submitCurrentAction(taskID, revision, action, payload, operationID); if (currentActionID.current === submittedActionID) onChanged(); }
    catch (reason) {
      if (currentActionID.current !== submittedActionID) return;
      if (reason instanceof APIError) {
        setError(reason.failure.error.message); setDetails(reason.failure.error.details ?? []); setPaths(reason.failure.error.field_paths); setGuard(reason.failure.error.guard_id); setRepositoryPaths(reason.failure.error.repository_paths ?? []);
        if (reason.failure.workflow_write_state === "unknown") setUncertain({ actionID: action.action_id, advice: reason.failure.recovery });
      } else {
        setError(reason instanceof Error ? reason.message : t("action.failure"));
        setUncertain({ actionID: action.action_id });
      }
      window.requestAnimationFrame(() => errorSummary.current?.focus());
    } finally { if (currentActionID.current === submittedActionID) setBusy(false); }
  };
  const titleKey = actionKindKey(action.action_kind);
  const recoveryID = pendingActionID ?? uncertain?.actionID ?? null;
  const refreshed = () => { setUncertain(null); onChanged(); };
  return <section className="surface action-panel" aria-labelledby="action-title">
    <div className="section-heading"><div><p className="eyebrow">{t("action.eyebrow")}</p><h2 id="action-title">{titleKey === null ? action.action_kind : t(titleKey)}</h2></div><div className="action-identity"><code>{action.action_kind}</code><code>{action.action_id}</code></div></div>
    <p className="action-purpose">{action.purpose}</p>
    <details className="action-requirements"><summary>{t("action.requirements")}<span className="disclosure-chevron" aria-hidden="true" /></summary><div className="action-contract-grid"><ContractList title={t("action.conditions")} values={action.conditions} /><ContractList title={t("action.effects")} values={action.allowed_effects} /><ContractList title={t("action.evidence")} values={action.required_evidence} /><ContractList title={t("action.steps")} values={action.method_steps} /></div></details>
    {error !== "" && <div ref={errorSummary} className="notice error error-summary" role="alert" tabIndex={-1}><strong>{guard === null ? t("action.rejected") : t("action.guard", { guard })}</strong> {error}{details.length > 0 && <ul>{details.map((detail) => <li key={detail.path}><code>{detail.path}</code>: {detail.message}</li>)}</ul>}{details.length === 0 && paths.length > 0 && <ul>{paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul>}{repositoryPaths.length > 0 && <ul>{repositoryPaths.map((path) => <li key={path}><code>{path}</code></li>)}</ul>}</div>}
    {recoveryID === null && <form onSubmit={(event) => { event.preventDefault(); void submit(); }}><SchemaField name={t("action.payload")} schema={action.payload_schema} value={payload} path="payload" errors={paths} onChange={(value) => setPayload(asObject(value))} /><div className="form-actions"><button className="button primary" disabled={disabled || busy}>{busy ? t("action.submitting") : t("action.submit")}</button></div></form>}
    {recoveryID !== null && <RecoveryPanel taskID={taskID} actionID={recoveryID} initial={uncertain?.advice} onChanged={refreshed} />}
  </section>;
}

function ContractList({ title, values }: { title: string; values: string[] }) { return <div><h3>{title}</h3><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></div>; }
function asObject(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
