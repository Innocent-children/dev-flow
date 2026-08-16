#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "tests",
  "contract",
  "testdata",
  "codex-0.147",
);

const fixtureFiles = Object.freeze({
  success: "success.jsonl",
  "core-domain-error": "core-domain-error.jsonl",
  "transport-error": "transport-error.jsonl",
});

const argv = process.argv.slice(2);

if (argv.length === 1 && argv[0] === "--version") {
  process.stdout.write("codex-cli 0.147.0\n");
} else if (argv.length === 2 && argv[0] === "emit") {
  await emitFixture(argv[1]);
} else if (argv[0] === "exec" && argv[1] === "--json") {
  const selectedFixture = process.env.DEV_FLOW_CODEX_FIXTURE;
  if (!selectedFixture) fail("DEV_FLOW_CODEX_FIXTURE is required for exec mode");
  await emitFixture(selectedFixture);
} else {
  fail("usage: fake-native-tool.mjs emit FIXTURE | --version | exec --json PROMPT");
}

async function emitFixture(name) {
  const filename = fixtureFiles[name];
  if (!filename) fail(`unknown Codex 0.147 fixture: ${name ?? "<missing>"}`);
  process.stdout.write(await readFile(join(fixtureRoot, filename), "utf8"));
}

function fail(message) {
  process.stderr.write(`fake-native-tool: ${message}\n`);
  process.exitCode = 2;
}
