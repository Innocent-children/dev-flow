import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLink, navigate } from "../app/router";
import { getFilterOptions, getTasks, TaskListResponse } from "../lib/api";
import { formatDate, nodeLabel, stateKey, useI18n } from "../lib/i18n";
import { Empty, Loading } from "./DashboardPage";
import { SelectField } from "../components/SelectField";

export function TaskListPage() {
  const { language, t } = useI18n();
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => getTasks(query).then((next) => { if (active) { setData(next); setError(""); } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t("readiness.unavailable")); });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [query, t]);
  useEffect(() => { const controller = new AbortController(); getFilterOptions(controller.signal).then((result) => setNodes(result.node_ids)).catch(() => setNodes([])); return () => controller.abort(); }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, entry] of new FormData(event.currentTarget).entries()) {
      const value = String(entry);
      if (value !== "") next.set(key, key === "updated_from" || key === "updated_to" ? new Date(value).toISOString() : value);
    }
    for (const [key, value] of [...next.entries()]) if (value === "") next.delete(key);
    setQuery(next); navigate(`/tasks${next.size === 0 ? "" : `?${next.toString()}`}`);
  };
  const pageTo = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); setQuery(next); navigate(`/tasks?${next.toString()}`); };
  const clear = () => { const next = new URLSearchParams(); setQuery(next); navigate("/tasks"); };
  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">{t("list.eyebrow")}</p><h1>{t("list.title")}</h1><p className="lede">{t("list.lede")}</p></div></header>
      <form key={query.toString()} className="filter-panel" onSubmit={submit} aria-label={t("list.filtersAria")}>
        <div className="filter-heading"><div><p className="eyebrow">{t("list.filtersAria")}</p><h2>{t("list.filtersTitle")}</h2></div><button className="button quiet compact" type="button" disabled={query.size === 0} onClick={clear}>{t("list.clear")}</button></div>
        <label className="filter-search">{t("list.search")}<input name="text" defaultValue={query.get("text") ?? ""} placeholder={t("list.searchPlaceholder")} /></label>
        <label className="filter-host">{t("list.host")}<SelectField name="host" ariaLabel={t("list.host")} defaultValue={query.get("host") ?? ""} options={[{ value: "", label: t("list.allHosts") }, { value: "codex", label: "Codex" }, { value: "deepseek", label: "DeepSeek" }]} /></label>
        <label className="filter-state">{t("list.lifecycle")}<SelectField name="lifecycle" ariaLabel={t("list.lifecycle")} defaultValue={query.get("lifecycle") ?? ""} options={[{ value: "", label: t("list.allStates") }, ...(["active", "blocked", "done", "cancelled"] as const).map((state) => ({ value: state, label: t(stateKey(state)) }))]} /></label>
        <label className="filter-repository">{t("list.repository")}<input name="repository" defaultValue={query.get("repository") ?? ""} placeholder={t("list.repositoryPlaceholder")} /></label>
        <label className="filter-node">{t("list.node")}<SelectField name="node" ariaLabel={t("list.node")} defaultValue={query.get("node") ?? ""} options={[{ value: "", label: t("list.allNodes") }, ...nodes.map((node) => ({ value: node, label: nodeLabel(node, language), description: node }))]} /></label>
        <label className="filter-date filter-from">{t("list.updatedFrom")}<input name="updated_from" type="datetime-local" defaultValue={localDateTime(query.get("updated_from"))} /></label>
        <label className="filter-date filter-to">{t("list.updatedTo")}<input name="updated_to" type="datetime-local" defaultValue={localDateTime(query.get("updated_to"))} /></label>
        <div className="filter-actions"><button className="button primary" type="submit">{t("list.apply")}</button></div>
      </form>
      {error !== "" && <div className="notice error" role="alert"><strong>{t("list.stale")}</strong> {error}</div>}
      {data === null ? <Loading label={t("list.loading")} /> : <section className="surface task-table-surface">
        <div className="section-heading table-heading"><div><p className="eyebrow">{t("list.eyebrow")}</p><h2>{t("list.resultsTitle")}</h2></div><span className="result-count">{t("list.resultsCount", { count: data.items.length })}</span></div>
        {data.items.length === 0 ? <Empty title={t("list.emptyTitle")} detail={t("list.emptyDetail")} /> : <div className="table-scroll"><table><caption className="sr-only">{t("list.resultsTitle")}</caption><thead><tr><th>{t("list.task")}</th><th>{t("list.state")}</th><th>{t("list.host")}</th><th>{t("list.revision")}</th><th>{t("list.updated")}</th></tr></thead><tbody>{data.items.map((task) => <tr key={task.task_id}><td><AppLink href={`/tasks/${encodeURIComponent(task.task_id)}`}><strong>{task.request_summary}</strong><code>{task.task_id}</code></AppLink></td><td><div className="table-status"><span className={`status-badge ${task.lifecycle}`}><span className="status-symbol" aria-hidden="true" />{t(stateKey(task.lifecycle))}</span>{task.archived && <span className="archive-label">{t("list.archived")}</span>}</div><small className="stage-cell"><span>{nodeLabel(task.current_node, language)}</span><code>{task.current_node}</code></small></td><td><span className="host-name">{task.origin_host}</span></td><td><code>r{task.revision}</code></td><td><time dateTime={task.updated_at}>{formatDate(task.updated_at, language)}</time></td></tr>)}</tbody></table></div>}
        {(data.items.length > 0 || data.page > 1) && <div className="pagination"><button type="button" className="button secondary" disabled={data.page <= 1} onClick={() => pageTo(data.page - 1)}>{t("list.previous")}</button><span>{t("list.page", { page: data.page })}</span><button type="button" className="button secondary" disabled={!data.has_next} onClick={() => pageTo(data.page + 1)}>{t("list.next")}</button></div>}
      </section>}
    </div>
  );
}

function localDateTime(value: string | null): string {
  if (value === null || value === "") return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
