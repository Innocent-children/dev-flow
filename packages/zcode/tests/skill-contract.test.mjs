import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertSkillResources } from "../../../tests/skills/resources.mjs";

test("ZCode Skill references are packaged, reachable and grounded in current implementation", async () => {
  await assertSkillResources({
    skillRoot: fileURLToPath(new URL("../skills/taskbelay/", import.meta.url)),
    packageRoot: fileURLToPath(new URL("../", import.meta.url)),
    repositoryRoot: fileURLToPath(new URL("../../../", import.meta.url)),
  });
});
