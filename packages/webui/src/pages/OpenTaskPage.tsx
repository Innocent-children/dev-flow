import { FormEvent, useEffect, useState } from "react";

import { navigate } from "../app/router";
import { openTask } from "../lib/api";
import { translateCurrent, useI18n } from "../lib/i18n";
import { SelectField } from "../components/SelectField";

export function OpenTaskPage() {
  const { language, t } = useI18n();
  const [mode, setMode] = useState<"create" | "resume">("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setError(""), [language]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await openTask({
        mode,
        request: String(data.get("request") ?? ""),
        acceptance_criteria: lines(data.get("acceptance")),
        verification_budget: JSON.stringify({ level: String(data.get("budget_level")), max_automatic_commands: Number(data.get("max_commands")), allow_full_suite: data.get("allow_full_suite") === "on", allow_manual_handoff: data.get("allow_manual_handoff") === "on" }),
        method_profile: String(data.get("method_profile")) as "plain" | "spec-kit" | "openspec",
        execution_host: String(data.get("execution_host")) as "codex" | "deepseek",
        primary_repository: { key: String(data.get("primary_key")), path: String(data.get("primary_path")) },
        additional_repositories: repositories(data.get("additional_repositories")),
      });
      if (result.redirect !== null) navigate(result.redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("open.failure"));
    } finally {
      setBusy(false);
    }
  };
  return <div className="page-stack narrow-page">
    <header className="page-header"><div><p className="eyebrow">{t("open.eyebrow")}</p><h1>{t(mode === "create" ? "open.createTitle" : "open.resumeTitle")}</h1><p className="lede">{t("open.lede")}</p></div></header>
    <div className="segmented start-mode" role="group" aria-label={t("open.modeAria")}>
      <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")}><strong>{t("open.create")}</strong><small>{t("open.createHint")}</small></button>
      <button type="button" aria-pressed={mode === "resume"} onClick={() => setMode("resume")}><strong>{t("open.resume")}</strong><small>{t("open.resumeHint")}</small></button>
    </div>
    {error !== "" && <div className="notice error" role="alert">{error}</div>}
    <form className="surface lifecycle-form" onSubmit={submit}>
      <fieldset><legend>{t("open.scope")}</legend><input type="hidden" name="primary_key" value="primary" /><div className="form-grid"><label>{t("open.executionHost")}<SelectField name="execution_host" ariaLabel={t("open.executionHost")} defaultValue="codex" options={[{ value: "codex", label: "Codex" }, { value: "deepseek", label: "DeepSeek" }]} /></label><label>{t("open.primaryPath")}<input name="primary_path" placeholder="/absolute/path/to/repository" required /></label><label className="full">{t("open.additional")} <span>{t("open.additionalHint")}</span><textarea name="additional_repositories" rows={3} disabled={mode === "resume"} /></label></div></fieldset>
      <fieldset disabled={mode === "resume"}><legend>{t("open.intent")}</legend><div className="form-grid"><label className="full">{t("open.request")}<textarea name="request" rows={4} required={mode === "create"} /></label><label className="full">{t("open.acceptance")} <span>{t("open.acceptanceHint")}</span><textarea name="acceptance" rows={4} required={mode === "create"} /></label></div></fieldset>
      {mode === "resume" && <><input type="hidden" name="request" value={t("open.resumeRequest")} /><input type="hidden" name="acceptance" value={t("open.resumeAcceptance")} /><input type="hidden" name="method_profile" value="plain" /><input type="hidden" name="budget_level" value="targeted" /><input type="hidden" name="max_commands" value="0" /></>}
      {mode === "create" && <details className="advanced-settings">
        <summary><span><strong>{t("open.advanced")}</strong><small>{t("open.advancedHint")}</small></span><span className="disclosure-chevron" aria-hidden="true" /></summary>
        <div className="advanced-content">
          <fieldset><legend>{t("open.method")}</legend><div className="form-grid"><label className="full">{t("open.method")}<SelectField name="method_profile" ariaLabel={t("open.method")} defaultValue="plain" options={[{ value: "plain", label: "Plain", description: t("open.methodPlain") }, { value: "spec-kit", label: "Spec Kit", description: t("open.methodSpecKit") }, { value: "openspec", label: "OpenSpec", description: t("open.methodOpenSpec") }]} /></label></div></fieldset>
          <fieldset><legend>{t("open.budget")}</legend><div className="form-grid"><label>{t("open.level")}<SelectField name="budget_level" ariaLabel={t("open.level")} defaultValue="targeted" options={[{ value: "minimal", label: "Minimal", description: t("open.budgetMinimal") }, { value: "targeted", label: "Targeted", description: t("open.budgetTargeted") }, { value: "full", label: "Full", description: t("open.budgetFull") }]} /></label><label>{t("open.maxCommands")}<input name="max_commands" type="number" min="0" max="64" defaultValue="4" /></label><label className="check"><input name="allow_full_suite" type="checkbox" /> {t("open.allowFull")}</label><label className="check"><input name="allow_manual_handoff" type="checkbox" defaultChecked /> {t("open.allowManual")}</label></div></fieldset>
        </div>
      </details>}
      <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? t("open.submitting") : t(mode === "create" ? "open.createSubmit" : "open.resumeSubmit")}</button></div>
    </form>
  </div>;
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "").split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function repositories(value: FormDataEntryValue | null): { key: string; path: string }[] {
  return lines(value).map((path, index) => {
    if (!path.startsWith("/")) throw new Error(translateCurrent("open.repoFormat"));
    return { key: `repo-${index + 1}`, path };
  });
}
