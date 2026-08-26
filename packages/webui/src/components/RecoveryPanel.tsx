import { useEffect, useState } from "react";

import { applyRecovery, assessRecovery, OperationProbe, RecoveryAdvice } from "../lib/api";
import { recoveryActionKey, useI18n } from "../lib/i18n";

export function RecoveryPanel({ taskID, operation, initial, onChanged }: { taskID: string; operation: OperationProbe; initial?: RecoveryAdvice; onChanged: () => void }) {
  const { language, t } = useI18n();
  const [advice, setAdvice] = useState<RecoveryAdvice | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setError(""), [language]);
  const assess = async () => { setBusy(true); setError(""); try { const result = await assessRecovery(taskID, operation); setAdvice(result.recovery); } catch (reason) { setError(reason instanceof Error ? reason.message : t("recovery.failure")); } finally { setBusy(false); } };
  const apply = async () => { if (advice === null || advice.action === "none" || advice.action === "correct_current_action") return; setBusy(true); setError(""); try { const result = await applyRecovery(taskID, operation, advice.action); setAdvice(result.recovery); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : t("recovery.failure")); } finally { setBusy(false); } };
  const adviceKey = advice === null ? null : recoveryActionKey(advice.action);
  return <section className="recovery-panel" aria-labelledby="recovery-title"><p className="eyebrow">{t("recovery.eyebrow")}</p><h3 id="recovery-title">{t("recovery.title")}</h3><p>{t("recovery.body")}</p>{error !== "" && <div className="notice error" role="alert">{error}</div>}{advice !== null && <div className="recovery-advice"><div className="recovery-action"><strong>{adviceKey === null ? advice.action : t(adviceKey)}</strong><code>{advice.action}</code></div><p>{advice.message}</p><small>{t(advice.retry_safe ? "recovery.safe" : "recovery.unsafe")}</small></div>}<div className="action-row"><button type="button" className="button secondary" disabled={busy} onClick={assess}>{busy ? t("recovery.assessing") : t("recovery.assess")}</button>{advice !== null && !["none", "correct_current_action"].includes(advice.action) && <button type="button" className="button primary" disabled={busy} onClick={apply}>{t("recovery.follow")}</button>}</div></section>;
}
