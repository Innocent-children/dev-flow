import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseArguments } from "../lib/cli.mjs";

const repositoryRoot = new URL("../../../", import.meta.url);
const documentedOptions = [
  "--adopt",
  "--confirm-downgrade",
  "--confirm-explicit-data",
  "--permanent",
  "--confirm-permanent",
];

test("maintained command references document specialized lifecycle options accepted by the parser", async () => {
  assert.equal(parseArguments(["install", "--host", "deepseek", "--adopt"]).adopt, true);
  assert.equal(parseArguments(["upgrade", "--host", "codex", "--confirm-downgrade", "token"]).downgradeToken, "token");
  const reset = parseArguments([
    "factory-reset",
    "--host", "all",
    "--confirm-reset", "reset-token",
    "--confirm-explicit-data", "/explicit/data",
    "--permanent",
    "--confirm-permanent", "permanent-token",
  ]);
  assert.deepEqual(reset.confirmedExplicitData, ["/explicit/data"]);
  assert.equal(reset.permanent, true);
  assert.equal(reset.permanentToken, "permanent-token");

  for (const relativePath of ["docs/COMMANDS.md", "docs/COMMANDS_en.md"]) {
    const contents = await readFile(new URL(relativePath, repositoryRoot), "utf8");
    for (const option of documentedOptions) {
      assert.match(contents, new RegExp(option, "u"), `${relativePath} must document ${option}`);
    }
  }
});
