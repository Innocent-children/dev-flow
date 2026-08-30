import { useEffect, useState } from "react";

import { AppLink } from "../app/router";
import { DashboardResponse, getDashboard } from "../lib/api";
import { formatDate, nodeLabel, readinessKey, stateKey, useI18n } from "../lib/i18n";

const lifecycleOrder = ["blocked", "active", "done", "cancelled"];

export function DashboardPage() {
  const { language, t } = useI18n();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => getDashboard().then((next) => { if (active) { setData(next); setError(""); } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t("readiness.unavailable")); });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [t]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">{t("dashboard.eyebrow")}</p><h1>{t("dashboard.title")}</h1><p className="lede">{t("dashboard.lede")}</p></div>
        <AppLink className="button secondary" href="/tasks">{t("dashboard.browse")}</AppLink>
      </header>
      {error !== "" && <div className="notice error" role="alert"><strong>{t("dashboard.stale")}</strong> {error}</div>}
      {data === null ? <Loading label={t("dashboard.loading")} /> : (
        <>
          <section className="metric-grid" aria-label={t("dashboard.countsAria")}>
            {[...data.counts].sort((left, right) => lifecycleOrder.indexOf(left.lifecycle) - lifecycleOrder.indexOf(right.lifecycle)).map((item) => (
              <AppLink key={item.lifecycle} href={`/tasks?lifecycle=${item.lifecycle}`} className={`metric-card ${item.lifecycle}`}>
                <span className="metric-label"><span className="status-symbol" aria-hidden="true" />{t(stateKey(item.lifecycle))}</span>
                <strong>{item.count}</strong>
                <small>{t("dashboard.viewMatching")}<span aria-hidden="true">→</span></small>
              </AppLink>
            ))}
          </section>
          <section className="surface">
            <div className="section-heading"><div><p className="eyebrow">{t("dashboard.recentEyebrow")}</p><h2>{t("dashboard.recentTitle")}</h2></div><span className={`readiness-badge ${data.readiness}`}>{t(readinessKey(data.readiness))}</span></div>
            {data.recent.length === 0 ? <Empty title={t("dashboard.emptyTitle")} detail={t("dashboard.emptyDetail")} /> : (
              <div className="task-list">
                {data.recent.map((task) => (
                  <AppLink className="task-row" href={`/tasks/${encodeURIComponent(task.task_id)}`} key={task.task_id}>
                    <span className={`status-badge ${task.lifecycle}`}><span className="status-symbol" aria-hidden="true" />{t(stateKey(task.lifecycle))}</span>
                    <span className="task-copy"><strong>{task.request_summary}</strong><small><span className="stage"><span>{nodeLabel(task.current_node, language)}</span><code>{task.current_node}</code></span><span>r{task.revision}</span><span>{formatDate(task.updated_at, language)}</span><span className="repository-context" title={task.worktree_path}><span>{t("repository.group")} <code>{task.repository_group_id.slice(0, 12)}</code></span><span>{task.worktree_path}</span></span></small></span>
                    <span className="task-row-tail"><code>{task.task_id}</code><span aria-hidden="true">›</span></span>
                  </AppLink>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function Loading({ label }: { label: string }) { return <div className="state-panel loading" role="status"><span className="spinner" aria-hidden="true" /><strong>{label}</strong></div>; }
export function Empty({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><strong>{title}</strong><span>{detail}</span></div>; }
