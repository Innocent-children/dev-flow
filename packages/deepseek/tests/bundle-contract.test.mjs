import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("bundle patch inserts exactly the DeepSeek integration plugin row", async () => {
  const patch = (await readFile(join(packageRoot, "cordis.patch.yml"), "utf8")).replace(/\r\n?/gu, "\n");

  assert.equal(
    patch,
    "- insert:\n    - id: dev-flow-deepseek\n      name: dev-flow-deepseek\n",
  );
});
