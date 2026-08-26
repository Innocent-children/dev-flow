import { Readiness, SystemStatusResponse } from "../lib/api";
import { readinessKey, useI18n } from "../lib/i18n";

const guidance: Record<Readiness, "runtime.readyBody" | "runtime.readOnlyBody" | "runtime.resetBody" | "runtime.incompatibleBody" | "runtime.unavailableBody"> = { ready: "runtime.readyBody", read_only: "runtime.readOnlyBody", reset_required: "runtime.resetBody", incompatible: "runtime.incompatibleBody", unavailable: "runtime.unavailableBody" };

export function RuntimeStatus({ status }: { status: SystemStatusResponse }) {
  const { t } = useI18n();
  return (
    <section className={`surface runtime-status ${status.readiness}`} aria-labelledby="runtime-state-title">
      <div className="runtime-state-heading">
        <span className="runtime-state-symbol" aria-hidden="true" />
        <div><p className="eyebrow">{t("system.runtime")}</p><h2 id="runtime-state-title">{t(readinessKey(status.readiness))}</h2></div>
      </div>
      <p>{t(guidance[status.readiness])}</p>
      <dl className="runtime-facts">
        <div><dt>Core</dt><dd><code>{status.core_identity}</code></dd></div>
        <div><dt>{t("runtime.dataRoot")}</dt><dd><code>{status.data_root_digest}</code></dd></div>
        <div><dt>{t("runtime.url")}</dt><dd><code>{status.url || t("runtime.notAvailable")}</code></dd></div>
      </dl>
      {status.readiness === "reset_required" && (
        <div className="reset-guidance" role="note">
          <strong>{t("runtime.resetTitle")}</strong>
          <p>{t("runtime.resetGuidance")}</p>
          <code>dev-flow webui reset</code>
        </div>
      )}
    </section>
  );
}
