import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildManagedBootstrapPrompt,
  readTaskHandoff,
  readTaskHandoffDraft,
  taskHandoffDigest,
  taskHandoffPaths,
  validateTaskHandoff,
  writeTaskHandoff,
} from "../lib/task-handoff.mjs";
import { handoffFixture, writeHandoffFixture } from "./fixtures/task-handoff.mjs";

test("handoff retains multi-turn corrections, original text, and separate unaccepted suggestions", async (t) => {
  const fixture = await materialFixture(t);
  const material = {
    ...handoffFixture("实现输入预览"),
    goal: "展示用户输入及其原始文本。",
    confirmed_requirements: [
      { text: "Raw 保留输入中的换行和空格。", source_ids: ["m3"] },
      { text: "不保留旧配置兼容。", source_ids: ["m5"] },
    ],
    terminology: ["Raw：输入原文；不表示未处理的网络响应。来源 m3。"],
    scope_and_constraints: ["仅修改输入预览，排除自动保存。来源 m5。"],
    investigation: ["已观察 src/preview.mjs 的文本展示逻辑；源 checkout HEAD abc，未运行测试。"],
    work_requirements: ["先编写规格；提交代码需要单独授权。来源 m5。"],
    unconfirmed_suggestions: ["增加自动保存；助手在 m4 提出，用户未采纳。"],
    assumptions: ["输入来自当前编辑框，尚待确认。"],
    open_questions: ["是否需要显示空输入提示？"],
    discussion: [
      { id: "m1", role: "user", text: "Raw 展示格式化结果。" },
      { id: "m2", role: "assistant", text: "按格式化文本实现。" },
      { id: "m3", role: "user", text: "更正：Raw 是输入原文，保留换行和空格，例如：\n  第一行\n\n第二行。" },
      { id: "m4", role: "assistant", text: "建议增加自动保存。" },
      { id: "m5", role: "user", text: "只做输入预览，不保留旧配置兼容。先写规格，提交要单独授权。开始开发。" },
    ],
  };
  await writeTaskHandoff(fixture.receiptPath, material, fixture.options);
  const handoff = await readTaskHandoff(fixture.receiptPath, taskHandoffDigest(material));
  assert.deepEqual(handoff.material, material);
  const saved = JSON.parse(await readFile(handoff.json_path, "utf8"));
  assert.deepEqual(saved.discussion, material.discussion);
  if (fixture.options.enforcePrivateModes) {
    for (const path of [handoff.json_path, handoff.markdown_path]) assert.equal((await stat(path)).mode & 0o077, 0);
  }
  const prompt = buildManagedBootstrapPrompt({ launchId: "launch-1", repositoryKey: "primary", handoff });
  const confirmed = prompt.split("## Confirmed requirements\n\n")[1].split("## Terminology")[0];
  assert.ok(confirmed.includes(material.confirmed_requirements[0].text));
  assert.equal(confirmed.includes("自动保存"), false);
  assert.equal(confirmed.includes("格式化结果"), false);
  assert.ok(prompt.includes(material.unconfirmed_suggestions[0]));
  for (const key of ["terminology", "scope_and_constraints", "investigation", "work_requirements", "assumptions", "open_questions"]) {
    assert.ok(prompt.includes(material[key][0]), key);
  }
  assert.ok(prompt.includes(handoff.markdown_path));
  const original = await readFile(handoff.markdown_path, "utf8");
  assert.ok(original.indexOf("### m1") < original.indexOf("### m5"));
  assert.ok(original.includes("格式化结果"));
});

test("large handoffs use complete files without truncating original messages or long requests", async (t) => {
  const fixture = await materialFixture(t);
  const text = "需求细节\n".repeat(100_000);
  const draftPath = await writeHandoffFixture(fixture.root, text);
  assert.ok((await stat(draftPath)).size > 1024 * 1024);
  const material = await readTaskHandoffDraft(draftPath, text);
  await writeTaskHandoff(fixture.receiptPath, material, fixture.options);
  const handoff = await readTaskHandoff(fixture.receiptPath, taskHandoffDigest(material));
  const prompt = buildManagedBootstrapPrompt({ launchId: "launch-large", repositoryKey: "primary", handoff });
  assert.ok(Buffer.byteLength(prompt, "utf8") < 24 * 1024);
  assert.ok(prompt.includes(handoff.markdown_path));
  assert.ok(prompt.includes("Read the complete handoff"));
  assert.equal(handoff.material.discussion[0].text, text);
  assert.equal(handoff.material.confirmed_requirements[0].text, text);
});

test("handoff rejects missing sections and unsupported requirement attribution", () => {
  const material = handoffFixture("Build the preview");
  assert.throws(() => validateTaskHandoff({ request: material.request }), /closed shape/u);
  assert.throws(() => validateTaskHandoff({ ...material, confirmed_requirements: [] }), /confirmed_requirements/u);
  assert.throws(() => validateTaskHandoff({ ...material, discussion: [material.discussion[0], material.discussion[0]] }), /unique/u);
  assert.throws(() => validateTaskHandoff({ ...material, confirmed_requirements: [{ text: "Unknown source", source_ids: ["missing"] }] }), /unknown discussion/u);
  assert.throws(() => validateTaskHandoff({ ...material, discussion: [{ ...material.discussion[0], role: "assistant" }] }), /user message/u);
});

test("drafts reject mismatched requests, duplicate JSON members, and invalid UTF-8", async (t) => {
  const fixture = await materialFixture(t);
  const draft = await writeHandoffFixture(fixture.root, "Build preview");
  await assert.rejects(readTaskHandoffDraft(draft, "Different task"), /does not match/u);
  await writeFile(draft, '{"request":"first","request":"second"}');
  await assert.rejects(readTaskHandoffDraft(draft, "second"), /invalid task handoff/u);
  await writeFile(draft, Buffer.from([0xff]));
  await assert.rejects(readTaskHandoffDraft(draft, "Build preview"), /UTF-8/u);
});

test("saved handoff is immutable and sender refuses missing or changed materials", async (t) => {
  const fixture = await materialFixture(t);
  const material = handoffFixture("Build preview");
  const digest = taskHandoffDigest(material);
  await writeTaskHandoff(fixture.receiptPath, material, fixture.options);
  await writeTaskHandoff(fixture.receiptPath, material, fixture.options);
  await assert.rejects(writeTaskHandoff(fixture.receiptPath, { ...material, goal: "Other work" }, fixture.options), /conflicts/u);
  await assert.rejects(readTaskHandoff(fixture.receiptPath, "0".repeat(64)), /does not match/u);
  const paths = taskHandoffPaths(fixture.receiptPath);
  await writeFile(paths.markdown_path, "A shortened summary");
  await assert.rejects(readTaskHandoff(fixture.receiptPath, digest), /has changed/u);
  await rm(paths.json_path);
  await assert.rejects(readTaskHandoff(fixture.receiptPath, digest), { code: "ENOENT" });
});

test("handoff storage rejects redirected material directories", async (t) => {
  const fixture = await materialFixture(t);
  const outside = join(fixture.root, "outside");
  await mkdir(outside);
  await symlink(outside, join(fixture.root, "handoffs"), process.platform === "win32" ? "junction" : undefined);
  await assert.rejects(writeTaskHandoff(fixture.receiptPath, handoffFixture("Build preview"), fixture.options), /non-symbolic-link directory/u);
});

async function materialFixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-handoff-中文 ")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, receiptPath: join(root, "primary.json"), options: { enforcePrivateModes: process.platform !== "win32" } };
}
