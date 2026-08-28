import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const workflow = await readFile(join(root, ".github/workflows/publish-npm.yml"), "utf8");

test("npm publication is manual, serialized per product, and minimally privileged", () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/mu);
  assert.match(workflow, /permissions:\n  contents: write\n  id-token: write/u);
  assert.doesNotMatch(workflow, /packages: write/u);
  assert.match(workflow, /group: npm-release-\$\{\{ inputs\.product \}\}/u);
  assert.match(workflow, /cancel-in-progress: false/u);
});

test("npm publication runs the existing release contracts on darwin-arm64", () => {
  for (const input of ["product", "channel", "mode", "version", "confirm_comprehension"]) {
    assert.match(workflow, new RegExp(`^      ${input}:`, "mu"));
  }
  assert.match(workflow, /runs-on: macos-15/u);
  assert.match(workflow, /node-version: 24/u);
  assert.match(workflow, /version: 11/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /test "\$\(uname -s\)-\$\(uname -m\)" = "Darwin-arm64"/u);
  assert.match(workflow, /pnpm run "release:\$RELEASE_PRODUCT"/u);
  assert.match(workflow, /pnpm run release:dev-flow/u);
});

test("workflow uses npm trusted publishing and keeps recovery output outside the repository", () => {
  assert.match(workflow, /id-token: write/u);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./u);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/u);
  assert.match(workflow, /RELEASE_OUTPUT: \$\{\{ runner\.temp \}\}/u);
  assert.match(workflow, /actions\/upload-artifact@v6/u);
  assert.match(workflow, /if: \$\{\{ always\(\)/u);
  assert.match(workflow, /dev-flow supports stable\/normal releases only/u);
  assert.match(workflow, /normal mode requires confirm_comprehension/u);
});
