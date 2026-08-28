import assert from "node:assert/strict";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";

import { CLIError, confirmPlan, parseArguments, promptForRequest } from "../lib/cli.mjs";
import { renderPlan, renderResult, resolveLanguage } from "../lib/presentation.mjs";

test("parser normalizes every lifecycle operation through one closed entry", () => {
  for (const operation of ["status", "doctor", "install", "upgrade", "repair", "reinstall", "uninstall", "factory-reset"]) {
    const args = [operation, "--host", "codex", ...(operation === "factory-reset" ? [] : [])];
    const request = parseArguments(args, { isTTY: false, noColor: true });
    assert.equal(request.operation, operation);
    assert.equal(request.host, "codex");
    assert.equal(request.outputMode, "plain");
  }
});

test("non-TTY mutations require Host while DeepSeek defaults to web", () => {
  assert.throws(() => parseArguments(["install"], { isTTY: false }), CLIError);
  const request = parseArguments(["install", "--host", "deepseek", "--yes"], { isTTY: false });
  assert.deepEqual(request.profiles, ["web"]);
  assert.equal(request.yes, true);
});

test("parser rejects path-like Profiles, conflicting output, and ordinary reset authorization", () => {
  for (const args of [
    ["install", "--host", "deepseek", "--profile", "../web"],
    ["status", "--json", "--plain"],
    ["install", "--host", "codex", "--confirm-reset", "RESET-X"],
    ["upgrade", "--host", "codex", "--version", "beta"],
  ]) assert.throws(() => parseArguments(args, { isTTY: false }), CLIError);
  const reset = parseArguments(["factory-reset", "--host", "all", "--yes"], { isTTY: false });
  assert.equal(reset.confirmationToken, null);
});

test("JSON rendering is exactly one parseable object", () => {
  const result = { operation: "status", status: "ready", changed: false, targets: [], next_step: null };
  const text = renderResult(result, { mode: "json", language: "en" });
  assert.equal(text.trim().split("\n").length, 1);
  assert.deepEqual(JSON.parse(text), result);
});

test("rich successful install renders one brand screen and contextual next steps", () => {
  const result = {
    operation: "install", status: "ready", changed: true, next_step: null,
    targets: [
      { host: "codex", profile: null, package_version: "0.8.0", state: "ready" },
      { host: "deepseek", profile: "web", package_version: "0.8.0", state: "restart_required" },
    ],
  };
  const text = renderResult(result, { mode: "rich", language: "zh-CN" });
  assert.match(text, /██████╗/u);
  assert.match(text, /Dev Flow 安装完成/u);
  assert.match(text, /\$dev-flow-codex:dev-flow <task description>/u);
  assert.match(text, /\/dev-flow <task description>/u);
  assert.match(text, /dev-flow webui start/u);
  assert.match(text, /dev-flow status/u);
  assert.doesNotMatch(renderResult(result, { mode: "plain", language: "en" }), /██████╗/u);
  assert.equal(renderResult(result, { mode: "json", language: "zh-CN" }), `${JSON.stringify(result)}\n`);
});

test("locale selection uses Chinese only for zh and English for every other locale", () => {
  assert.equal(resolveLanguage({ LANG: "zh_CN.UTF-8" }), "zh-CN");
  assert.equal(resolveLanguage({ LANG: "zh-TW" }), "zh-CN");
  assert.equal(resolveLanguage({ LANG: "en_US.UTF-8" }), "en");
  assert.equal(resolveLanguage({ LANG: "ja_JP.UTF-8" }), "en");
  assert.equal(resolveLanguage({ LANG: "fr_FR.UTF-8" }), "en");
  assert.equal(resolveLanguage({}), "en");
});

test("no-argument TTY home installs Codex without asking for a lifecycle operation", async () => {
  const output = captureOutput();
  const request = await promptForRequest({ input: Readable.from(["1\n"]), output, language: "en" });
  assert.equal(request.operation, "install");
  assert.equal(request.host, "codex");
  assert.match(output.text, /1\. Install Codex/u);
  assert.match(output.text, /4\. Manage existing installation/u);
  assert.doesNotMatch(output.text, /1\. status/u);
});

test("manage existing installation opens the complete operation menu", async () => {
  const output = captureOutput();
  const input = scriptedInput(["4\n", "1\n", "3\n", "web\n"]);
  const request = await promptForRequest({ input, output, language: "en" });
  assert.equal(request.operation, "status");
  assert.equal(request.host, "all");
  assert.match(output.text, /Manage existing installation/u);
  assert.match(output.text, /1\. status/u);
});

test("Chinese locale renders the complete interactive menu and plan in Chinese", async () => {
  const output = captureOutput();
  const input = scriptedInput(["4\n", "8\n", "3\n", "web\n"]);
  const request = await promptForRequest({ input, output, language: "zh-CN" });
  assert.equal(request.operation, "factory-reset");
  assert.equal(request.host, "all");
  assert.match(output.text, /Dev Flow 生命周期管理器/u);
  assert.match(output.text, /4\. 管理现有安装/u);
  assert.match(output.text, /8\. 恢复出厂设置/u);
  assert.match(output.text, /3\. 全部/u);
  assert.doesNotMatch(output.text, /Manage existing installation|Choose:|Operation:/u);

  const plan = renderPlan({
    operation: "factory-reset",
    planId: "plan-language",
    impacts: [
      "factory-reset codex Adapter",
      "Remove every installed Adapter before shared data cleanup",
      "Move confirmed data to macOS Trash",
    ],
  }, { mode: "plain", language: "zh-CN" });
  assert.match(plan, /^执行计划 恢复出厂设置/u);
  assert.match(plan, /恢复出厂设置 Codex Adapter/u);
  assert.match(plan, /移除所有已安装的 Adapter/u);
  assert.match(plan, /移入 macOS 废纸篓/u);
  assert.doesNotMatch(plan, /Plan|Remove every|Move confirmed/u);
});

test("Chinese locale renders reset confirmation in Chinese", async () => {
  const output = captureOutput();
  const input = scriptedInput(["RESET-ABC123\n"], { isTTY: true });
  const confirmed = await confirmPlan({
    confirmationClass: "reset",
    confirmationToken: "RESET-ABC123",
    permanentToken: null,
  }, { confirmationToken: null }, { input, output, language: "zh-CN" });
  assert.equal(confirmed, true);
  assert.match(output.text, /输入 RESET-ABC123 确认恢复出厂设置/u);
  assert.doesNotMatch(output.text, /Type .* to confirm reset/u);
});

function captureOutput() {
  let text = "";
  const stream = new Writable({ write(chunk, _encoding, callback) { text += chunk.toString(); callback(); } });
  Object.defineProperty(stream, "text", { get: () => text });
  return stream;
}

function scriptedInput(lines, { isTTY = false } = {}) {
  const input = new PassThrough();
  Object.defineProperty(input, "isTTY", { value: isTTY });
  const writeNext = (index) => {
    if (index === lines.length) {
      input.end();
      return;
    }
    input.write(lines[index]);
    setTimeout(() => writeNext(index + 1), 5);
  };
  setTimeout(() => writeNext(0), 0);
  return input;
}
