import { useEffect, useState } from "react";

import { AppLink, currentRoute } from "../app/router";
import { getSystemStatus, Readiness } from "../lib/api";
import devFlowMark from "../assets/dev-flow-mark.svg";
import { readinessKey, useI18n } from "../lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const route = currentRoute();
  const { language, setLanguage, t } = useI18n();
  const [readiness, setReadiness] = useState<Readiness>("unavailable");
  useEffect(() => {
    let active = true;
    const refresh = () => getSystemStatus().then((status) => { if (active) setReadiness(status.readiness); }).catch(() => { if (active) setReadiness("unavailable"); });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const routeTitle = route.page === "dashboard"
    ? t("shell.overview")
    : route.page === "open-task"
      ? t("shell.openTask")
      : route.page === "system"
        ? t("shell.system")
        : t("shell.tasks");
  return (
    <>
      <a className="skip-link" href="#main-content">{t("shell.skip")}</a>
      <div className="app-frame">
        <aside className="sidebar">
          <AppLink href="/" className="brand" aria-label={t("shell.dashboardAria")}>
            <img className="brand-mark" src={devFlowMark} alt="" />
            <span className="brand-copy"><strong>Dev Flow</strong><small>{t("shell.subtitle")}</small></span>
          </AppLink>
          <nav aria-label={t("shell.navAria")}>
            <span className="nav-section-label">{t("shell.workspace")}</span>
            <AppLink href="/" aria-label={t("shell.overview")} title={t("shell.overview")} aria-current={route.page === "dashboard" ? "page" : undefined} className={route.page === "dashboard" ? "nav-link active" : "nav-link"}><NavIcon name="overview" /><span className="nav-copy">{t("shell.overview")}</span></AppLink>
            <AppLink href="/tasks" aria-label={t("shell.tasks")} title={t("shell.tasks")} aria-current={route.page === "tasks" || route.page === "task" ? "page" : undefined} className={route.page === "tasks" || route.page === "task" ? "nav-link active" : "nav-link"}><NavIcon name="tasks" /><span className="nav-copy">{t("shell.tasks")}</span></AppLink>
            <AppLink href="/system" aria-label={t("shell.system")} title={t("shell.system")} aria-current={route.page === "system" ? "page" : undefined} className={route.page === "system" ? "nav-link active" : "nav-link"}><NavIcon name="system" /><span className="nav-copy">{t("shell.system")}</span></AppLink>
          </nav>
          <div className="sidebar-footer">
            <AppLink href="/system" className={`runtime-chip ${readiness}`} aria-label={`${t("shell.runtime")}: ${t(readinessKey(readiness))}`} title={`${t("shell.runtime")}: ${t(readinessKey(readiness))}`}>
              <span className="runtime-dot" aria-hidden="true" />
              <span className="runtime-copy"><small>{t("shell.runtime")}</small><strong>{t(readinessKey(readiness))}</strong></span>
            </AppLink>
            <div className="language-switch" role="group" aria-label={t("shell.language")}><button type="button" aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>{t("shell.chinese")}</button><button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>{t("shell.english")}</button></div>
          </div>
        </aside>
        <div className="workspace">
          <header className="toolbar">
            <div className="toolbar-context"><span>{t("shell.workspace")}</span><strong>{routeTitle}</strong></div>
            <AppLink href="/tasks/new" aria-label={t("shell.openTask")} title={t("shell.openTask")} aria-current={route.page === "open-task" ? "page" : undefined} className="button primary toolbar-create"><NavIcon name="create" /><span>{t("shell.openTask")}</span></AppLink>
          </header>
          <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </>
  );
}

function NavIcon({ name }: { name: "overview" | "tasks" | "system" | "create" }) {
  const path = name === "overview"
    ? <><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.5" /></>
    : name === "tasks"
      ? <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8" /></>
      : name === "system"
        ? <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" /></>
        : <><path d="M12 5v14M5 12h14" /><rect x="3.5" y="3.5" width="17" height="17" rx="4" /></>;
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
