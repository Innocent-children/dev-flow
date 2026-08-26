import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { purgeTask } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function PurgeDialog({ taskID, revision, onClose, onPurged }: { taskID: string; revision: number; onClose: () => void; onPurged: () => void }) {
  const { language, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setError(""), [language]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await purgeTask(taskID, revision, String(data.get("task_id")), String(data.get("reason")));
      onPurged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("purge.failure"));
      setBusy(false);
    }
  };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><section ref={dialog} className="dialog destructive" role="dialog" aria-modal="true" aria-labelledby="purge-title" aria-describedby="purge-description" onKeyDown={(event) => trapDialogFocus(event, dialog.current, busy ? () => undefined : onClose)}><p className="eyebrow">{t("purge.eyebrow")}</p><h2 id="purge-title">{t("purge.title")}</h2><p id="purge-description">{t("purge.body")}</p>{error !== "" && <div className="notice error" role="alert">{error}</div>}<form onSubmit={submit}><label>{t("purge.typeID")} <code>{taskID}</code><input ref={input} name="task_id" autoComplete="off" required /></label><label>{t("lifecycle.reason")}<textarea name="reason" rows={3} required /></label><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>{t("purge.keep")}</button><button className="button danger" disabled={busy}>{busy ? t("purge.busy") : t("purge.confirm")}</button></div></form></section></div>;
}

function trapDialogFocus(event: KeyboardEvent<HTMLElement>, dialog: HTMLElement | null, onClose: () => void) {
  if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
  if (event.key !== "Tab" || dialog === null) return;
  const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  if (controls.length === 0) { event.preventDefault(); return; }
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
