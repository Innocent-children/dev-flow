import { FormEvent, useEffect, useState } from "react";

import { navigate } from "../app/router";
import { resumeTask } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { SelectField } from "../components/SelectField";

export function OpenTaskPage() {
  const { language, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setError(""), [language]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await resumeTask({
        execution_host: String(data.get("execution_host")) as "codex" | "deepseek",
        repository_path: String(data.get("repository_path") ?? ""),
      });
      if (result.redirect !== null) navigate(result.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("open.failure"));
    } finally {
      setBusy(false);
    }
  };
  return <div className="page-stack narrow-page">
    <header className="page-header"><div><p className="eyebrow">{t("open.eyebrow")}</p><h1>{t("open.resumeTitle")}</h1><p className="lede">{t("open.resumeOnlyLede")}</p></div></header>
    <div className="notice warning" role="note"><strong>{t("open.createInHost")}</strong> {t("open.createInHostDetail")}</div>
    {error !== "" && <div className="notice error" role="alert">{error}</div>}
    <form className="surface lifecycle-form" onSubmit={submit}>
      <fieldset><legend>{t("open.scope")}</legend><div className="form-grid"><label>{t("open.executionHost")}<SelectField name="execution_host" ariaLabel={t("open.executionHost")} defaultValue="codex" options={[{ value: "codex", label: "Codex" }, { value: "deepseek", label: "DeepSeek" }]} /></label><label>{t("open.worktreePath")}<input name="repository_path" placeholder="/absolute/path/to/original/task-worktree" required /></label></div></fieldset>
      <p className="graph-disclaimer">{t("open.resumeInstanceHint")}</p>
      <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? t("open.submitting") : t("open.resumeSubmit")}</button></div>
    </form>
  </div>;
}
