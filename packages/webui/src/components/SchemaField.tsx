import { useId } from "react";

import { JSONSchema } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { SelectField } from "./SelectField";

export function SchemaField({ name, schema, value, path, errors, onChange }: { name: string; schema: JSONSchema; value: unknown; path: string; errors: string[]; onChange: (value: unknown) => void }) {
  const { t } = useI18n();
  const id = useId();
  const errorID = `${id}-error`;
  const invalid = hasFieldError(path, errors);
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    const nullable = alternatives.some((item) => item.type === "null");
    const choices = alternatives.filter((item) => item.type !== "null");
    if (nullable && value === null) {
      return <fieldset className="schema-field" aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined}><legend>{label(name)}</legend><button type="button" className="button secondary" onClick={() => onChange(defaultValue(choices[0]))}>{t("schema.provide")}</button><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></fieldset>;
    }
    const selected = selectAlternative(choices, value);
    return <fieldset className="schema-field" aria-invalid={invalid || undefined}><legend>{label(name)}</legend>{choices.length > 1 && <div className="schema-variant"><span>{t("schema.variant")}</span><SelectField ariaLabel={t("schema.variant")} value={String(selected)} options={choices.map((choice, index) => ({ value: String(index), label: choice.title ?? alternativeName(choice, index, t("schema.option", { index: index + 1 })) }))} onChange={(next) => onChange(defaultValue(choices[Number(next)]))} /></div>}{nullable && <button type="button" className="button secondary compact" onClick={() => onChange(null)}>{t("schema.clear")}</button>}<SchemaField name={name} schema={choices[selected]} value={value} path={path} errors={errors} onChange={onChange} /></fieldset>;
  }
  if (schema.const !== undefined) {
    return <label className="schema-field"><span>{label(name)}</span><input value={String(schema.const)} readOnly aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined} /><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></label>;
  }
  if (schema.enum !== undefined) {
    const current = value ?? schema.enum[0];
    return <label className="schema-field"><span>{label(name)}</span><SelectField ariaLabel={label(name)} ariaInvalid={invalid} ariaDescribedBy={invalid ? errorID : undefined} value={String(current)} options={schema.enum.map((item) => ({ value: String(item), label: String(item) }))} onChange={(next) => onChange(coerceEnum(schema.enum!, next))} /><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></label>;
  }
  const type = primaryType(schema.type);
  if (type === "object") {
    const object = isObject(value) ? value : {};
    return <fieldset className="schema-object" aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined}><legend>{label(name)}</legend>{schema.description !== undefined && <p>{schema.description}</p>}{Object.entries(schema.properties ?? {}).map(([child, childSchema]) => <SchemaField key={child} name={child} schema={childSchema} value={object[child] ?? defaultValue(childSchema)} path={`${path}.${child}`} errors={errors} onChange={(next) => onChange({ ...object, [child]: next })} />)}<FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></fieldset>;
  }
  if (type === "array") {
    const items = Array.isArray(value) ? value : [];
    return <fieldset className="schema-array" aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined}><legend>{label(name)}</legend>{items.map((item, index) => <div className="schema-array-item" key={index}><SchemaField name={`${label(name)} ${index + 1}`} schema={schema.items ?? { type: "string" }} value={item} path={`${path}[${index}]`} errors={errors} onChange={(next) => onChange(items.map((current, itemIndex) => itemIndex === index ? next : current))} /><button type="button" className="button danger-ghost compact" aria-label={`${t("schema.remove")} ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>{t("schema.remove")}</button></div>)}<button type="button" className="button secondary compact" disabled={schema.maxItems !== undefined && items.length >= schema.maxItems} onClick={() => onChange([...items, defaultValue(schema.items ?? { type: "string" })])}>{t("schema.add", { name: label(name).toLowerCase() })}</button><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></fieldset>;
  }
  if (type === "boolean") {
    return <label className="schema-field schema-check"><input type="checkbox" checked={Boolean(value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined} onChange={(event) => onChange(event.target.checked)} /><span>{label(name)}</span><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></label>;
  }
  if (type === "integer" || type === "number") {
    return <label className="schema-field"><span>{label(name)}</span><input type="number" min={schema.minimum} max={schema.maximum} value={typeof value === "number" ? value : schema.minimum ?? 0} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined} onChange={(event) => onChange(Number(event.target.value))} /><FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></label>;
  }
  const text = typeof value === "string" ? value : "";
  return <label className="schema-field"><span>{label(name)}</span>{schema.maxLength !== undefined && schema.maxLength > 256 ? <textarea rows={3} value={text} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined} onChange={(event) => onChange(event.target.value)} /> : <input value={text} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorID : undefined} onChange={(event) => onChange(event.target.value)} />}<FieldErrors id={errorID} path={path} errors={errors} rejected={t("schema.rejected", { paths: "{paths}" })} /></label>;
}

export function defaultValue(schema: JSONSchema): unknown {
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    const preferred = alternatives.find((item) => item.type !== "null") ?? alternatives[0];
    return preferred === undefined ? null : defaultValue(preferred);
  }
  if (schema.const !== undefined) return schema.const;
  if (schema.enum !== undefined) return schema.enum[0] ?? "";
  switch (primaryType(schema.type)) {
    case "object": return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, child]) => [name, defaultValue(child)]));
    case "array": return [];
    case "boolean": return false;
    case "integer": case "number": return schema.minimum ?? 0;
    case "null": return null;
    default: return "";
  }
}

function FieldErrors({ id, path, errors, rejected }: { id: string; path: string; errors: string[]; rejected: string }) {
  const matching = errors.filter((item) => item === path || item.startsWith(`${path}.`) || item.startsWith(`${path}[`));
  return matching.length === 0 ? null : <small id={id} className="field-error">{rejected.replace("{paths}", matching.join(", "))}</small>;
}
function hasFieldError(path: string, errors: string[]): boolean { return errors.some((item) => item === path || item.startsWith(`${path}.`) || item.startsWith(`${path}[`)); }
function primaryType(type: JSONSchema["type"]): string { return Array.isArray(type) ? type.find((item) => item !== "null") ?? "null" : type ?? "string"; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function label(value: string): string { return value; }
function selectAlternative(choices: JSONSchema[], value: unknown): number { if (!isObject(value)) return 0; const found = choices.findIndex((choice) => Object.entries(choice.properties ?? {}).some(([name, child]) => child.const !== undefined && value[name] === child.const)); return found < 0 ? 0 : found; }
function alternativeName(schema: JSONSchema, _index: number, fallback: string): string { const constant = Object.values(schema.properties ?? {}).find((item) => item.const !== undefined)?.const; return constant === undefined ? fallback : String(constant); }
function coerceEnum(values: (string | number | boolean)[], raw: string): string | number | boolean { return values.find((item) => String(item) === raw) ?? raw; }
