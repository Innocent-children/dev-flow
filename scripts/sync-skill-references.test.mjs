import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkSharedSkillReferences, sharedSkillReferences, writeSharedSkillReferences } from "./sync-skill-references.mjs";

test("shared references render each Host and detect a changed package copy", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-shared-skill-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "skills/dev-flow/core");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "example.md"), '# Example\r\n\r\n{"host":"{{host}}"}\r\n');
  for (const host of ["codex", "deepseek"]) {
    await writeSharedSkillReferences({ root, host });
    const rendered = (await sharedSkillReferences({ root, host })).get("references/example.md");
    assert.ok(rendered.includes(`{"host":"${host}"}`));
    assert.equal(rendered.includes("\r"), false);
  }
  await checkSharedSkillReferences({ root });
  const copy = join(root, "packages/deepseek/skills/dev-flow/references/example.md");
  await writeFile(copy, (await readFile(copy, "utf8")).replace('"deepseek"', '"codex"'));
  await assert.rejects(checkSharedSkillReferences({ root }), /copies differ from shared sources/u);
  await writeSharedSkillReferences({ root, host: "deepseek" });
  await checkSharedSkillReferences({ root });
});

test("shared rendering rejects an unsupported Host or unknown substitution", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-shared-skill-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "skills/dev-flow/core"), { recursive: true });
  await writeFile(join(root, "skills/dev-flow/core/example.md"), "{{unknown}}\n");
  await assert.rejects(sharedSkillReferences({ root, host: "other" }), /host must be codex or deepseek/u);
  await assert.rejects(sharedSkillReferences({ root, host: "codex" }), /Unknown Skill substitution/u);
});
