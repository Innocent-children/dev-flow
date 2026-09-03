import { KeyboardEvent, RefObject, useEffect, useRef, useState } from "react";

import {
  abandonTask,
  cancelTask,
  prepareTaskRelocation,
  setTaskArchived,
  TaskSummary,
  WorkspaceView,
} from "../lib/api";
import { PurgeDialog } from "./PurgeDialog";
import { useI18n } from "../lib/i18n";

export function LifecycleActions({ task, workspace, onChanged, onPurged }: { task: TaskSummary; workspace: WorkspaceView; onChanged: () => void; onPurged: () => void }) {
  const { language, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const abandonTrigger = useRef<HTMLButtonElement>(null);
  const purgeTrigger = useRef<HTMLButtonElement>(null);
  const lifecycleRegion = useRef<HTMLElement>(null);
  useEffect(() => setError(""), [language]);
  const terminal = task.lifecycle === "done" || task.lifecycle === "cancelled";
  const archive = async () => {
    setBusy(true); setError("");
    try { await setTaskArchived(task.task_id, task.revision, !task.archived); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("lifecycle.failure")); }
    finally { setBusy(false); }
  };
  const cancel = async (reason: string) => {
    setBusy(true); setError("");
    try { await cancelTask(task.task_id, task.revision, reason); setCancelOpen(false); onChanged(); focusRegion(lifecycleRegion); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("lifecycle.failure")); }
    finally { setBusy(false); }
  };
  const abandon = async (reason: string) => {
    setBusy(true); setError("");
    try { await abandonTask(task.task_id, task.revision, task.execution_host, reason); setAbandonOpen(false); onChanged(); focusRegion(lifecycleRegion); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("lifecycle.failure")); }
    finally { setBusy(false); }
  };
  const prepareRelocation = async () => {
    if (!window.confirm(t("lifecycle.confirmRelocation"))) return;
    setBusy(true); setError("");
    try { await prepareTaskRelocation(task.task_id, task.revision, task.execution_host); onChanged(); focusRegion(lifecycleRegion); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("lifecycle.failure")); }
    finally { setBusy(false); }
  };
  const closeCancel = () => closeDialog(setCancelOpen, cancelTrigger);
  const closeAbandon = () => closeDialog(setAbandonOpen, abandonTrigger);
  const closePurge = () => closeDialog(setPurgeOpen, purgeTrigger);
  return <section ref={lifecycleRegion} className="surface lifecycle-actions" aria-labelledby="lifecycle-title" tabIndex={-1}>
    <div><p className="eyebrow">{t("lifecycle.eyebrow")}</p><h2 id="lifecycle-title">{t("lifecycle.title")}</h2></div>
    {error !== "" && !cancelOpen && !abandonOpen && <div className="notice error" role="alert">{error}</div>}
    <div className="action-row">
      {!terminal && !workspace.relocation.pending && <button className="button secondary" disabled={busy} onClick={prepareRelocation}>{busy ? t("lifecycle.preparingRelocation") : t("lifecycle.prepareRelocation")}</button>}
      {!terminal && <button ref={cancelTrigger} className="button danger-ghost" disabled={busy} onClick={() => { setError(""); setCancelOpen(true); }}>{t("lifecycle.cancel")}</button>}
      {!terminal && <button ref={abandonTrigger} className="button danger-ghost" disabled={busy} onClick={() => { setError(""); setAbandonOpen(true); }}>{t("lifecycle.abandon")}</button>}
      {terminal && <button className="button secondary" disabled={busy} onClick={archive}>{t(task.archived ? "lifecycle.restore" : "lifecycle.archive")}</button>}
      {terminal && <button ref={purgeTrigger} className="button danger-ghost" disabled={busy} onClick={() => setPurgeOpen(true)}>{t("lifecycle.purge")}</button>}
    </div>
    {cancelOpen && <ReasonDialog title={t("lifecycle.cancelTitle")} body={t("lifecycle.cancelBody")} confirm={t("lifecycle.confirmCancel")} busyLabel={t("lifecycle.cancelling")} busy={busy} error={error} onClose={closeCancel} onConfirm={cancel} />}
    {abandonOpen && <ReasonDialog title={t("lifecycle.abandonTitle")} body={t("lifecycle.abandonBody")} confirm={t("lifecycle.confirmAbandon")} busyLabel={t("lifecycle.abandoning")} busy={busy} error={error} onClose={closeAbandon} onConfirm={abandon} />}
    {purgeOpen && <PurgeDialog taskID={task.task_id} revision={task.revision} onClose={closePurge} onPurged={onPurged} />}
  </section>;
}

function ReasonDialog({ title, body, confirm, busyLabel, busy, error, onClose, onConfirm }: { title: string; body: string; confirm: string; busyLabel: string; busy: boolean; error: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLElement>(null);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => trapDialogFocus(event, dialog.current, busy ? () => undefined : onClose)}><p className="eyebrow">{t("lifecycle.eyebrow")}</p><h2>{title}</h2><p>{body}</p>{error !== "" && <div className="notice error" role="alert">{error}</div>}<label>{t("lifecycle.reason")}<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label><div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={onClose}>{t("lifecycle.continue")}</button><button className="button danger" disabled={busy || reason.trim() === ""} onClick={() => onConfirm(reason.trim())}>{busy ? busyLabel : confirm}</button></div></section></div>;
}

function closeDialog(setOpen: (open: boolean) => void, trigger: RefObject<HTMLButtonElement | null>) {
  setOpen(false);
  window.requestAnimationFrame(() => trigger.current?.focus());
}

function focusRegion(region: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => region.current?.focus());
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
