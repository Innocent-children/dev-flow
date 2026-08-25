import assert from "node:assert/strict";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";

import { CLIError, parseArguments, promptForRequest } from "../lib/cli.mjs";
import { renderResult } from "../lib/presentation.mjs";

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

test("no-argument TTY home installs Codex without asking for a lifecycle operation", async () => {
  const output = captureOutput();
  const request = await promptForRequest({ input: Readable.from(["1\n"]), output });
  assert.equal(request.operation, "install");
  assert.equal(request.host, "codex");
  assert.match(output.text, /1\. Install Codex/u);
  assert.match(output.text, /4\. Manage existing installation/u);
  assert.doesNotMatch(output.text, /1\. status/u);
});

test("manage existing installation opens the complete operation menu", async () => {
  const output = captureOutput();
  const input = scriptedInput(["4\n", "1\n", "3\n", "web\n"]);
  const request = await promptForRequest({ input, output });
  assert.equal(request.operation, "status");
  assert.equal(request.host, "all");
  assert.match(output.text, /Manage existing installation/u);
  assert.match(output.text, /1\. status/u);
});

function captureOutput() {
  let text = "";
  const stream = new Writable({ write(chunk, _encoding, callback) { text += chunk.toString(); callback(); } });
  Object.defineProperty(stream, "text", { get: () => text });
  return stream;
}

function scriptedInput(lines) {
  const input = new PassThrough();
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
