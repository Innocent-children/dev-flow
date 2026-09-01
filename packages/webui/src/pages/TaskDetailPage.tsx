import { useEffect, useRef, useState } from "react";

import { AppLink, navigate } from "../app/router";
import { ActionPanel } from "../components/ActionPanel";
import { BlockerPanel } from "../components/BlockerPanel";
import { LifecycleActions } from "../components/LifecycleActions";
import { ProcessGraph } from "../components/ProcessGraph";
import { TaskTimeline } from "../components/TaskTimeline";
import { getTask, TaskDetailResponse } from "../lib/api";
import { formatDate, nodeLabel, stateKey, useI18n } from "../lib/i18n";
import { Loading } from "./DashboardPage";

export function TaskDetailPage({ taskID }: { taskID: string }) {
  const { language, t } = useI18n();
  const [data, setData] = useState<TaskDetailResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef<number | null>(null);
  const resultFocus = useRef<HTMLElement>(null);
  const focusAfterRefresh = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshAfterMutation = () => { focusAfterRefresh.current = true; setRefreshKey((value) => value + 1); };
  useEffect(() => { revision.current = null; setData(null); }, [taskID]);
  useEffect(() => {
    let active = true;
    const refresh = () => getTask(taskID).then((next) => { if (!active) return; if (revision.current !== null && revision.current !== next.summary.revision) setStale(true); revision.current = next.summary.revision; setData(next); setError(""); window.setTimeout(() => { if (active) setStale(false); }, 180); }).catch((reason: unknown) => { if (active) { setStale(true); setError(reason instanceof Error ? reason.message : t("detail.unavailable")); } });
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [taskID, refreshKey, t]);
  useEffect(() => {
    if (data === null || !focusAfterRefresh.current) return;
    focusAfterRefresh.current = false;
    window.requestAnimationFrame(() => resultFocus.current?.focus());
  }, [data?.summary.revision]);
  if (data === null) return <Loading label={t("detail.loading")} />;
  return <div className="page-stack" data-task-revision={data.summary.revision} data-stale={stale || error !== ""}>
    <header className="page-header detail-header">
      <div className="detail-title"><AppLink href="/tasks" className="back-link">← {t("detail.allTasks")}</AppLink><div className="detail-kicker"><span className={`status-badge ${data.summary.lifecycle}`}><span className="status-symbol" aria-hidden="true" />{t(stateKey(data.summary.lifecycle))}</span><span className="host-name">{data.summary.origin_host}</span>{data.summary.archived && <span className="archive-label">{t("detail.archived")}</span>}</div><h1>{data.summary.request_summary}</h1><code className="identity">{data.summary.task_id}</code></div>
      <dl className="revision-card"><div><dt>{t("detail.currentRevision")}</dt><dd>r{data.summary.revision}</dd></div><div><dt>{t("detail.updated")}</dt><dd><time dateTime={data.summary.updated_at}>{formatDate(data.summary.updated_at, language)}</time></dd></div></dl>
    </header>
    {(error !== "" || data.readiness !== "ready") && <div className="notice warning" role="status"><strong>{t(error !== "" ? "detail.stale" : "detail.readOnly")}</strong> {error || t("detail.readOnlyGuidance")}</div>}
    <section className="detail-grid primary-summary"><article ref={resultFocus} className="surface current-stage" tabIndex={-1}><p className="eyebrow">{t("detail.stage")}</p><div className="stage-heading"><h2>{nodeLabel(data.summary.current_node, language)}</h2><code>{data.summary.current_node}</code></div><p className="task-intent">{data.intent}</p><dl className="fact-grid"><div><dt>{t("detail.method")}</dt><dd>{data.method_profile}</dd></div><div><dt>{t("detail.verification")}</dt><dd><VerificationBudget value={data.verification_budget} /></dd></div>{data.current_action !== null && <><div><dt>{t("detail.action")}</dt><dd><code>{data.current_action.action_kind}</code></dd></div><div><dt>{t("detail.legalPaths")}</dt><dd>{data.current_action.legal_transition_ids.join(", ") || t("detail.none")}</dd></div></>}</dl></article><article className="surface repository-scope"><p className="eyebrow">{t("detail.scope")}</p><h2>{t("detail.repositories", { count: data.repositories.length })}</h2><ul className="repository-list">{data.repositories.map((repository) => <li key={repository.key}><span>{repository.role}</span><strong>{repository.key}</strong><small>{t("repository.group")} {repository.repository_group_id.slice(0, 12)}</small><code>{repository.path}</code></li>)}</ul></article></section>
    <FileScopePanel value={data.file_scope} />
    {data.outcome !== null && <section className="surface outcome-panel"><div><p className="eyebrow">{t("detail.outcome")}</p><h2>{data.outcome.label}</h2></div><pre>{formatFact(data.outcome.value)}</pre></section>}
    {data.current_action !== null && data.current_action.action_kind === "RESOLVE_BLOCKER" && data.blocker !== null ? <BlockerPanel taskID={data.summary.task_id} revision={data.summary.revision} action={data.current_action} blocker={data.blocker} disabled={data.readiness !== "ready" || stale || error !== ""} onChanged={refreshAfterMutation} /> : data.current_action !== null && <ActionPanel taskID={data.summary.task_id} revision={data.summary.revision} action={data.current_action} disabled={data.readiness !== "ready" || stale || error !== ""} onChanged={refreshAfterMutation} />}
    {data.readiness === "ready" && <LifecycleActions task={data.summary} onChanged={refreshAfterMutation} onPurged={() => navigate("/tasks")} />}
    <section className="surface"><div className="section-heading"><div><p className="eyebrow">{t("detail.definition")}</p><h2>{t("detail.graph")}</h2></div><code>{data.graph.process_id}</code></div><p className="graph-disclaimer">{t("detail.graphDisclaimer")}</p><ProcessGraph graph={data.graph} /></section>
    <section className="split-sections"><article className="surface"><p className="eyebrow">{t("detail.history")}</p><h2>{t("detail.timeline")}</h2><TaskTimeline events={data.events} /></article><article className="surface"><p className="eyebrow">{t("detail.facts")}</p><h2>{t("detail.evidence")}</h2><FactGroup title={t("detail.acceptance")} values={data.acceptance_criteria} empty={t("detail.noneRecorded")} /><FactCards facts={[...data.baselines, ...data.records, ...data.evidence]} /></article></section>
  </div>;
}

function FactGroup({ title, values, empty }: { title: string; values: string[]; empty: string }) { return <div className="fact-group"><h3>{title}</h3>{values.length === 0 ? <p>{empty}</p> : <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>}</div>; }
function FactCards({ facts }: { facts: { kind: string; label: string; value: string }[] }) { return <div className="fact-cards">{facts.map((fact, index) => <details key={`${fact.kind}-${index}`}><summary>{fact.label}</summary><pre>{formatFact(fact.value)}</pre></details>)}</div>; }
function VerificationBudget({ value }: { value: string }) { const { t } = useI18n(); try { const budget = JSON.parse(value) as { level?: unknown; max_automatic_commands?: unknown; allow_full_suite?: unknown; allow_manual_handoff?: unknown }; return <span className="budget-summary"><strong>{String(budget.level ?? "")}</strong>{typeof budget.max_automatic_commands === "number" && <small>{t("detail.commandLimit", { count: budget.max_automatic_commands })}</small>}{budget.allow_full_suite === true && <small>{t("detail.fullSuiteAllowed")}</small>}{budget.allow_manual_handoff === true && <small>{t("detail.manualHandoffAllowed")}</small>}</span>; } catch { return <code>{value}</code>; } }
function FileScopePanel({ value }: { value: TaskDetailResponse["file_scope"] }) { const { t } = useI18n(); const ready = value.unexplained_paths.length === 0; return <section className="surface"><div className="section-heading"><div><p className="eyebrow">{t("scope.eyebrow")}</p><h2>{ready ? t("scope.ready") : t("scope.blocked")}</h2></div><span className={`status-badge ${ready ? "done" : "blocked"}`}>{ready ? t("scope.explained") : t("scope.unexplained", { count: value.unexplained_paths.length })}</span></div><dl className="fact-grid"><div><dt>{t("scope.expected")}</dt><dd>{value.expected_paths.length}</dd></div><div><dt>{t("scope.changed")}</dt><dd>{value.task_changed_paths.length}</dd></div><div><dt>{t("scope.decisions")}</dt><dd>{value.decision_count}</dd></div><div><dt>{t("scope.coveredTools")}</dt><dd>{value.covered_host_tools.join(", ") || t("detail.none")}</dd></div></dl>{value.unexplained_paths.length > 0 && <div className="notice warning"><strong>{t("scope.needsDecision")}</strong><ul>{value.unexplained_paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul></div>}<p className="graph-disclaimer">{t("scope.boundary")}</p></section>; }
function formatFact(value: string): string { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
