import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readLocalPackages } from "../lib/local-packages.mjs";
import { runLifecycle } from "../lib/lifecycle.mjs";
import { parseArguments } from "../lib/cli.mjs";

test("a declared development distribution binds both artifact paths and bytes", async t => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-local-source-"));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(join(root,"local-packages"));
  const entries = {};
  for (const product of ["codex","deepseek"]) {
    const bytes = Buffer.from(`${product} artifact fixture`);
    entries[product] = {path:`local-packages/${product}.tgz`,version:"1.2.3",sha256:createHash("sha256").update(bytes).digest("hex")};
    await writeFile(join(root,entries[product].path),bytes);
  }
  await writeFile(join(root,"package.json"),JSON.stringify({devFlowLocalPackages:entries}));
  const selected = await readLocalPackages(root);
  assert.equal(selected.codex.path,await realpath(join(root,"local-packages/codex.tgz")));
  await writeFile(selected.codex.path,"altered");
  let hostCalls = 0;
  await assert.rejects(runLifecycle(parseArguments(["install","--host","all","--yes"]),{
    packageRoot:root,
    codexDriver:{observe(){hostCalls++;}},
    deepseekDriver:{observe(){hostCalls++;}},
  }),/digest mismatch/);
  assert.equal(hostCalls,0);
  entries.codex.path = "../outside.tgz";
  await writeFile(join(root,"package.json"),JSON.stringify({devFlowLocalPackages:entries}));
  await assert.rejects(readLocalPackages(root),/metadata/);
});

test("a registry distribution does not select undeclared local artifacts",async t=>{
  const root=await mkdtemp(join(tmpdir(),"dev-flow-registry-source-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,"package.json"),JSON.stringify({name:"@imotong/dev-flow"}));
  assert.equal(await readLocalPackages(root),null);
});
