import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PUBLIC_RELEASE_DOCUMENT_PATHS, syncPublicReleaseDocs, verifyPublicReleaseDocs } from "../scripts/sync-public-release-docs.mjs";

test("maintained public release documentation matches recorded public identities", async () => {
  const root = new URL("../", import.meta.url);
  assert.deepEqual(await verifyPublicReleaseDocs(fileURLPath(root)), {
    core_version: "0.6.3",
    codex: { version: "0.7.4", core_version: "0.6.3" },
    deepseek: { version: "0.7.4", core_version: "0.6.3" },
  });
});

test("public release documentation follows executable product identities", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-public-docs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "release"), { recursive: true });
  await writeFile(join(root, "release", "public-versions.json"), `${JSON.stringify({
    core_version: "1.0.0",
    codex: { version: "2.0.0", core_version: "1.0.0" },
    deepseek: { version: "3.0.0", core_version: "1.0.0" },
  }, null, 2)}\n`);
  for (const relativePath of PUBLIC_RELEASE_DOCUMENT_PATHS) {
    const path = join(root, relativePath);
    await mkdir(join(path, ".."), { recursive: true });
    const contents = relativePath === "docs/DEEPSEEK_en.md" || relativePath === "packages/deepseek/README.md"
      ? "DeepSeek dev-flow-deepseek@3.0.0 Core 1.0.0 deepseek-v3.0.0\n"
      : relativePath === "docs/CODEX_en.md" || relativePath === "packages/codex/README.md"
        ? "Codex dev-flow-codex@2.0.0 Core 1.0.0 codex-v2.0.0\n"
        : "Core | 1.0.0\ndev-flow-codex | 2.0.0 | 1.0.0 | codex-v2.0.0\ndev-flow-deepseek | 3.0.0 | 1.0.0 | deepseek-v3.0.0\n";
    await writeFile(path, contents);
  }

  const result = await syncPublicReleaseDocs(root, { product: "codex", version: "2.0.1", coreVersion: "1.0.1" });
  assert(result.changedPaths.includes("release/public-versions.json"));
  assert.match(await readFile(join(root, "README.md"), "utf8"), /dev-flow-codex \| 2\.0\.1 \| 1\.0\.1/u);
  assert.match(await readFile(join(root, "README.md"), "utf8"), /dev-flow-deepseek \| 3\.0\.0 \| 1\.0\.0/u);
  assert.match(await readFile(join(root, "docs/CODEX_en.md"), "utf8"), /dev-flow-codex@2\.0\.1 Core 1\.0\.1/u);
  assert.match(await readFile(join(root, "docs/DEEPSEEK_en.md"), "utf8"), /dev-flow-deepseek@3\.0\.0 Core 1\.0\.0/u);
});

function fileURLPath(url) {
  return decodeURIComponent(url.pathname);
}
