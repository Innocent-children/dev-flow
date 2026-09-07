import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { promptForRequest } from "../lib/cli.mjs";
import { supportsDesktopPet, loadPetPlatform } from "../lib/platform.mjs";
import { ensurePetInstalled } from "../lib/platform/windows/pet-installer.mjs";

test("Windows x64 menu exposes both pet commands and rejects other Windows architectures", async () => {
  assert.equal(supportsDesktopPet("win32", "x64"), true);
  for (const arch of ["ia32", "arm64"])
    assert.equal(supportsDesktopPet("win32", arch), false);
  assert.equal(
    (await loadPetPlatform("win32", "x64")).PET_RUNTIME_DIRECTORY,
    "win32-x64",
  );
  for (const [input, expected] of [
    ["5\n", "start"],
    ["6\n", "stop"],
  ]) {
    let text = "";
    const request = await promptForRequest({
      input: Readable.from([input]),
      output: {
        write(value) {
          text += value;
        },
      },
      language: "en",
      platform: "win32",
      arch: "x64",
    });
    assert.deepEqual(request, { pet: expected });
    assert.match(text, /Start the desktop pet/u);
    assert.match(text, /Stop the desktop pet/u);
  }
});
test("Windows pet installation preserves an existing app, settings and appearances", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-pet-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "package"),
    petDirectory = join(root, "pet");
  const app = join(source, "runtime", "win32-x64", "DevFlowPet");
  await mkdir(app, { recursive: true });
  await writeFile(join(app, "DevFlowPet.exe"), "fixture executable");
  const first = await ensurePetInstalled({
    petDirectory,
    sourcePackageRoots: [source],
  });
  assert.equal(first.newlyInstalled, true);
  await writeFile(join(petDirectory, "settings.json"), "retained");
  await writeFile(join(app, "DevFlowPet.exe"), "new fixture executable");
  const again = await ensurePetInstalled({
    petDirectory,
    sourcePackageRoots: [source],
  });
  assert.equal(again.newlyInstalled, false);
  assert.equal(
    await readFile(first.targetExecutable, "utf8"),
    "fixture executable",
  );
  assert.equal(
    await readFile(join(petDirectory, "settings.json"), "utf8"),
    "retained",
  );
  await ensurePetInstalled({petDirectory,sourcePackageRoots:[source],replaceExisting:true});
  assert.equal(await readFile(first.targetExecutable,"utf8"),"new fixture executable");
  assert.equal(await readFile(join(petDirectory,"settings.json"),"utf8"),"retained");
});
