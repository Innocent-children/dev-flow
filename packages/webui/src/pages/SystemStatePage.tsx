import { useEffect, useState } from "react";

import { RuntimeStatus } from "../components/RuntimeStatus";
import { getSystemStatus, SystemStatusResponse } from "../lib/api";
import { Loading } from "./DashboardPage";
import { useI18n } from "../lib/i18n";

export function SystemStatePage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => getSystemStatus()
      .then((next) => { if (active) { setStatus(next); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t("readiness.unavailable")); });
    refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [t]);

  return (
    <div className="page-stack narrow-page">
      <header className="page-header">
        <div><p className="eyebrow">{t("system.eyebrow")}</p><h1>{t("system.title")}</h1><p className="lede">{t("system.lede")}</p></div>
      </header>
      {error !== "" && (
        <section className="surface runtime-status unavailable" role="alert">
          <div className="runtime-state-heading"><span className="runtime-state-symbol" aria-hidden="true" /><div><p className="eyebrow">{t("system.runtime")}</p><h2>{t("system.unavailable")}</h2></div></div>
          <p>{error}</p><p>{t("system.returnShell")}</p>
        </section>
      )}
      {status === null && error === "" ? <Loading label={t("system.loading")} /> : status !== null && <RuntimeStatus status={status} />}
    </div>
  );
}
