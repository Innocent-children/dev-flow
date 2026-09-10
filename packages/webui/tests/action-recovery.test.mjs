import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { transformWithOxc } from "vite";

// Run the shipped components with a deterministic hook scheduler and simulated HTTP.
// Browser layout and native events are checked separately in the local WebUI.
const i18n = { useI18n: () => ({ language: "en", t: (key) => key }), actionKindKey: () => null, recoveryActionKey: () => null, translateCurrent: (key) => key };
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };

test("an artifact rejection displays omitted files separately from editable fields", async () => {
  const hooks = scheduler();
  class APIError extends Error {
    failure = { workflow_write_state: "not_committed", error: { message: "Missing artifacts", field_paths: ["artifacts.other_process"], guard_id: null, repository_paths: ["openspec/config.yaml"] } };
  }
  const module = await load("components/ActionPanel.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": { APIError, submitCurrentAction: async () => { throw new APIError(); } },
    "./RecoveryPanel": { RecoveryPanel: "recovery" }, "./SchemaField": { SchemaField: "schema", defaultValue: () => ({}) },
  });
  const props = { taskID: "task", revision: 1, action: action(), disabled: false, onChanged() {}, pendingActionID: null };
  let tree = hooks.render(module.ActionPanel, props);
  find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await tick(); tree = hooks.render(module.ActionPanel, props);
  assert.ok(find(tree, (node) => node.type === "code" && node.props.children === "openspec/config.yaml"));
  assert.deepEqual([...find(tree, (node) => node.type === "schema").props.errors], ["artifacts.other_process"]);
  assert.equal(find(tree, (node) => node.type === "recovery"), undefined);
});

test("a correctable check explanation displays Core's field requirement", async () => {
  const hooks = scheduler();
  class APIError extends Error {
    failure = { workflow_write_state: "not_committed", error: { message: "Invalid check explanation", field_paths: ["payload.node_result.budget_adjustment.additional_checks"], guard_id: null, details: [{ path: "payload.node_result.budget_adjustment.additional_checks", rule: "budget_checks_required", message: "Include the check name and reason." }] } };
  }
  const module = await load("components/ActionPanel.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": { APIError, submitCurrentAction: async () => { throw new APIError(); } },
    "./RecoveryPanel": { RecoveryPanel: "recovery" }, "./SchemaField": { SchemaField: "schema", defaultValue: () => ({}) },
  });
  const props = { taskID: "task", revision: 1, action: action(), disabled: false, onChanged() {}, pendingActionID: null };
  let tree = hooks.render(module.ActionPanel, props);
  find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await tick(); tree = hooks.render(module.ActionPanel, props);
  assert.ok(JSON.stringify(tree).includes("Include the check name and reason."));
  assert.ok(find(tree, (node) => node.type === "form"));
  assert.equal(find(tree, (node) => node.type === "recovery"), undefined);
});

test("HTTP submission and recovery carry semantic content and stable Action references", async () => {
  const sent = [];
  const api = await load("lib/api.ts", { "./i18n": i18n }, {
    fetch: async (path, init) => { sent.push({ path, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
    document: { querySelector: () => ({ content: "session" }) },
  });
  await api.submitCurrentAction("task", 4, { action_id: "action" }, { transition_id: "tests_passed", node_result: {} }, "request");
  await api.assessRecovery("task", "action");
  await api.applyRecovery("task", "action");
  assert.deepEqual(Object.keys(sent[0].body).sort(), ["action_id", "csrf", "payload", "request_id", "task_revision"]);
  assert.deepEqual(sent[0].body.payload, { transition_id: "tests_passed", node_result: {} });
  for (const request of sent.slice(1)) assert.deepEqual(request.body, { action_id: "action", csrf: "session" });
});

test("a transport failure enters recovery and a reloaded pending Action has no submit form", async () => {
  const hooks = scheduler();
  const module = await load("components/ActionPanel.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": { APIError: class extends Error {}, submitCurrentAction: async () => { throw new TypeError("response lost"); } },
    "./RecoveryPanel": { RecoveryPanel: "recovery" }, "./SchemaField": { SchemaField: "schema", defaultValue: () => ({}) },
  });
  const props = { taskID: "task", revision: 4, action: action(), disabled: false, onChanged() {}, pendingActionID: null };
  let tree = hooks.render(module.ActionPanel, props);
  find(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await tick();
  tree = hooks.render(module.ActionPanel, props);
  assert.equal(find(tree, (node) => node.type === "form"), undefined);
  assert.equal(find(tree, (node) => node.type === "recovery").props.actionID, "action");

  const reloaded = scheduler();
  const fresh = await load("components/ActionPanel.tsx", {
    react: reloaded.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": { APIError: class extends Error {}, submitCurrentAction: async () => assert.fail("pending Action was submitted") },
    "./RecoveryPanel": { RecoveryPanel: "recovery" }, "./SchemaField": { SchemaField: "schema", defaultValue: () => ({}) },
  });
  tree = reloaded.render(fresh.ActionPanel, { ...props, pendingActionID: "retained-action" });
  assert.equal(find(tree, (node) => node.type === "form"), undefined);
  assert.equal(find(tree, (node) => node.type === "recovery").props.actionID, "retained-action");
});

test("a late failure from the previous Action cannot replace the refreshed Action", async () => {
  const hooks = scheduler();
  let reject;
  const module = await load("components/ActionPanel.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": { APIError: class extends Error {}, submitCurrentAction: () => new Promise((_resolve, fail) => { reject = fail; }) },
    "./RecoveryPanel": { RecoveryPanel: "recovery" }, "./SchemaField": { SchemaField: "schema", defaultValue: () => ({}) },
  });
  const props = { taskID: "task", revision: 4, action: action(), disabled: false, onChanged() {}, pendingActionID: null };
  const first = hooks.render(module.ActionPanel, props);
  find(first, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  const next = { ...props, revision: 5, action: { ...action(), action_id: "next-action" } };
  hooks.render(module.ActionPanel, next);
  reject(new TypeError("old response lost"));
  await tick();
  const refreshed = hooks.render(module.ActionPanel, next);
  assert.equal(find(refreshed, (node) => node.type === "recovery"), undefined);
  assert.equal(find(refreshed, (node) => node.type === "button" && node.props.children === "action.submit").props.disabled, false);
});

test("recovery reads Core before applying the saved Action by ID", async () => {
  const hooks = scheduler(), calls = [];
  let changed = 0;
  const module = await load("components/RecoveryPanel.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n,
    "../lib/api": {
      assessRecovery: async (...args) => { calls.push(["assess", ...args]); return { recovery: { action: "submit_recovery_apply", retry_safe: false, message: "Retained" } }; },
      applyRecovery: async (...args) => { calls.push(["apply", ...args]); return { recovery: null }; },
    },
  });
  const props = { taskID: "task", actionID: "retained-action", onChanged: () => { changed++; } };
  hooks.render(module.RecoveryPanel, props);
  await tick();
  const tree = hooks.render(module.RecoveryPanel, props);
  await find(tree, (node) => node.type === "button" && node.props.children === "recovery.follow").props.onClick();
  assert.deepEqual(calls, [["assess", "task", "retained-action"], ["apply", "task", "retained-action"]]);
  assert.equal(changed, 1);
});

test("nullable semantic fields remain null in the form", async () => {
  const hooks = scheduler();
  const module = await load("components/SchemaField.tsx", {
    react: hooks.react, "react/jsx-runtime": jsx, "../lib/i18n": i18n, "./SelectField": { SelectField: "select" },
  });
  const nullable = { anyOf: [{ type: "object", properties: {} }, { type: "null" }] };
  assert.equal(module.defaultValue(nullable), null);
  const tree = hooks.render(module.SchemaField, { name: "payload", schema: { type: "object", properties: { budget_adjustment: nullable } }, value: { budget_adjustment: null }, path: "payload", errors: [], onChange() {} });
  assert.equal(find(tree, (node) => node.type === module.SchemaField).props.value, null);
});

function action() {
  return { action_id: "action", action_kind: "COMPLETE_TEST", payload_schema: {}, conditions: [], allowed_effects: [], required_evidence: [], method_steps: [], legal_transition_ids: [] };
}

async function load(path, dependencies, globals = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { code } = await transformWithOxc(source, path);
  const context = vm.createContext({ crypto: webcrypto, window: { requestAnimationFrame: (callback) => callback() }, ...globals });
  const module = new vm.SourceTextModule(code, { context });
  await module.link((name) => {
    const exports = dependencies[name];
    assert.ok(exports, `unexpected import ${name}`);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

function scheduler() {
  const slots = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useId() { return `field-${cursor++}`; },
    useEffect(effect, dependencies) { const index = cursor++; if (!slots[index] || dependencies.some((item, i) => item !== slots[index][i])) { slots[index] = [...dependencies]; effects.push(effect); } },
  };
  return { react, render(component, props) { cursor = 0; const tree = component(props); for (const effect of effects.splice(0)) effect(); return tree; } };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return;
  if (Array.isArray(tree)) { for (const child of tree) { const result = find(child, predicate); if (result) return result; } return; }
  if (predicate(tree)) return tree;
  return find(tree.props?.children, predicate);
}
function tick() { return new Promise((resolve) => setImmediate(resolve)); }
