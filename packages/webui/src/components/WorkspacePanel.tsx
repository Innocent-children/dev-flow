import { TaskDetailResponse } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function WorkspacePanel({ task }: { task: TaskDetailResponse }) {
  const { t } = useI18n();
  const workspace = task.workspace;
  const unavailable = workspace.provisioning_status === "unavailable";
  return <section className="surface workspace-panel">
    <div className="section-heading"><div><p className="eyebrow">{t("workspace.eyebrow")}</p><h2>{t("workspace.title")}</h2></div><span className={`status-badge ${unavailable ? "cancelled" : ""}`}>{unavailable ? t("workspace.provisioningUnavailable") : t("workspace.provisioningLastKnown")}</span></div>
    <p className="workspace-provisioning-note">{unavailable ? t("workspace.provisioningUnavailableDetail") : t("workspace.provisioningLastKnownDetail")}</p>
    {workspace.history_conflict && <div className="notice warning"><strong>{t("workspace.historyConflict")}</strong></div>}
    {workspace.relocation.pending && <div className="notice warning"><strong>{t("workspace.relocationPending", { id: workspace.relocation.relocation_id ?? "unknown" })}</strong></div>}
    <div className="workspace-repositories">{task.repositories.map((repository) => <article key={repository.key} className="workspace-repository">
      <div className="section-heading"><div><p className="eyebrow">{repository.role}</p><h3>{repository.key}</h3></div><code>{repository.workspace_origin.mode}</code></div>
      <dl className="fact-grid">
        <div><dt>{t("workspace.remoteBase")}</dt><dd><code>{repository.workspace_origin.remote_name}/{repository.workspace_origin.base_branch}</code></dd></div>
        <div><dt>{t("workspace.baseCommit")}</dt><dd><code title={repository.workspace_origin.base_commit}>{short(repository.workspace_origin.base_commit)}</code></dd></div>
        <div><dt>{t("workspace.taskBranch")}</dt><dd><code>{repository.workspace_origin.task_branch}</code><small>{short(repository.workspace_observation.current_head)}</small></dd></div>
        <div><dt>{t("workspace.receipt")}</dt><dd><code>{repository.workspace_origin.provisioning_receipt_id}</code></dd></div>
        <div><dt>{t("workspace.history")}</dt><dd>{repository.workspace_observation.history_relation}</dd></div>
        <div><dt>{t("workspace.content")}</dt><dd><code title={repository.workspace_observation.content_digest}>{short(repository.workspace_observation.content_digest)}</code></dd></div>
      </dl>
      <code className="workspace-path">{repository.path}</code>
      {repository.workspace_observation.task_surface.length > 0 && <details><summary>{t("workspace.currentSurface")} ({repository.workspace_observation.task_surface.length})</summary><ul>{repository.workspace_observation.task_surface.map((entry) => <li key={`${entry.path}-${entry.change_type}`}><code>{entry.path}</code> <span>{entry.change_type}</span></li>)}</ul></details>}
    </article>)}</div>
    <div className={`notice ${workspace.current_changed_paths.length === 0 ? "success" : "warning"}`}><strong>{workspace.current_changed_paths.length === 0 ? t("workspace.clean") : t("workspace.changed", { count: workspace.current_changed_paths.length })}</strong>{workspace.current_changed_paths.length > 0 && <ul>{workspace.current_changed_paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul>}</div>
    {workspace.cleanup.terminal && <div className="workspace-cleanup"><h3>{t("workspace.cleanupTitle")}</h3><p>{t("workspace.cleanupBody")}</p></div>}
  </section>;
}

function short(value: string) { return value.length > 12 ? value.slice(0, 12) : value; }
