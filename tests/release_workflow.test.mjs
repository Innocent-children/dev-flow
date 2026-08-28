import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const workflow = await readFile(join(root, ".github/workflows/publish-npm.yml"), "utf8");

test("npm publication is manual, globally serialized, and minimally privileged", () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/mu);
  assert.match(workflow, /permissions:\n  contents: read\n  id-token: write/u);
  assert.doesNotMatch(workflow, /packages: write/u);
  assert.match(workflow, /group: npm-release/u);
  assert.match(workflow, /cancel-in-progress: false/u);
});

test("npm publication runs the existing release contracts on darwin-arm64", () => {
  for (const input of ["product", "channel", "version"]) {
    assert.match(workflow, new RegExp(`^      ${input}:`, "mu"));
  }
  assert.doesNotMatch(workflow, /^      (mode|confirm_comprehension):/mu);
  assert.match(workflow, /runs-on: macos-15/u);
  assert.match(workflow, /actions\/setup-go@v7/u);
  assert.match(workflow, /go-version: 1\.26\.5/u);
  assert.match(workflow, /node-version: 24\.18\.0/u);
  assert.match(workflow, /version: 11\.24\.0/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /test "\$\(uname -s\)-\$\(uname -m\)" = "Darwin-arm64"/u);
  assert.match(workflow, /pnpm run "release:\$RELEASE_PRODUCT"/u);
  assert.match(workflow, /pnpm run release:dev-flow/u);
});

test("workflow uses short-lived npm and GitHub App credentials", () => {
  assert.match(workflow, /id-token: write/u);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|registry-url|GH_TOKEN: \$\{\{ github\.token \}\}/u);
  assert.match(workflow, /actions\/create-github-app-token@v3/u);
  assert.match(workflow, /client-id: \$\{\{ vars\.RELEASE_APP_CLIENT_ID \}\}/u);
  assert.match(workflow, /private-key: \$\{\{ secrets\.RELEASE_APP_PRIVATE_KEY \}\}/u);
  assert.match(workflow, /permission-contents: write/u);
  assert.match(workflow, /GH_TOKEN: \$\{\{ steps\.release-app-token\.outputs\.token \}\}/u);
  assert.match(workflow, /gh auth setup-git/u);
  assert.match(workflow, /RELEASE_OUTPUT: \$\{\{ runner\.temp \}\}/u);
  assert.match(workflow, /actions\/upload-artifact@v6/u);
  assert.match(workflow, /if: \$\{\{ always\(\)/u);
  assert.match(workflow, /dev-flow supports stable releases only/u);
  assert.doesNotMatch(workflow, /--mode|--confirm-comprehension/u);
});
