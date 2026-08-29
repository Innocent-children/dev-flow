import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDeepSeekDriver } from "../lib/hosts/deepseek.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";

test("DeepSeek driver hides artifact lifecycle and records only verified explicit Profile", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-deepseek-test-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {} });
  let present = false;
  const calls = [];
  const run = async (executable, arguments_, options = {}) => {
    calls.push([executable, arguments_]);
    if (executable === "dsh" && arguments_[0] === "--version") return { stdout: "dsh 0.1.0-rc.8\n", stderr: "" };
    if (executable === "dsh" && arguments_.includes("--dump-config")) return { stdout: present ? "- id: dev-flow-deepseek\n" : "bundles: []\n", stderr: "" };
    if (executable === "dsh" && arguments_.at(-2) === "add") {
      present = true;
      return { stdout: "", stderr: "" };
    }
    if (executable === "npm" && arguments_[0] === "pack") {
      const filename = "dev-flow-deepseek-0.8.0.tgz";
      await writeFile(join(options.cwd, filename), "artifact\n");
      return { stdout: `${JSON.stringify([{ name: "dev-flow-deepseek", version: "0.8.0", filename }])}\n`, stderr: "" };
    }
    return { stdout: "", stderr: "" };
  };
  const driver = createDeepSeekDriver({ paths, run, now: () => new Date("2026-08-25T00:00:00Z") });
  const before = await driver.observe("web");
  const progress = [];
  const result = await driver.execute("install", {
    profile: "web", targetVersion: "0.8.0", observed: before, onProgress: (step) => progress.push(step),
  });
  assert.equal(result.changed, true);
  assert.deepEqual(await driver.knownProfiles(), ["web"]);
  assert.equal(calls.some(([executable, args]) => executable === "dsh" && args[0] === "plugin" && args.includes("add")), true);
  assert.equal(calls.some(([, args]) => args.some((value) => value === "PROFILE=web")), false);
  assert.deepEqual(progress, ["deepseek.web.verify_artifact", "deepseek.web.add", "deepseek.web.write_receipt"]);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("DeepSeek stale contribution is removed only after target artifact verification", async () => {
  const calls = [];
  let present = true;
  const paths = {
    managerRoot: "/manager",
    profilesDirectory: "/manager/profiles",
    runsDirectory: "/manager/runs",
    homeDirectory: "/home",
  };
  const run = async (executable, arguments_, options = {}) => {
    calls.push([executable, arguments_]);
    if (executable === "npm") throw new Error("registry unavailable");
    if (arguments_.includes("--dump-config")) return { stdout: present ? "- id: dev-flow-deepseek\n" : "", stderr: "" };
    if (arguments_.includes("remove")) present = false;
    return { stdout: "dsh 0.1.0-rc.8\n", stderr: "" };
  };
  const driver = createDeepSeekDriver({ paths, run });
  await assert.rejects(driver.execute("upgrade", {
    profile: "web", targetVersion: "0.8.0",
    observed: { hostAvailable: true, hostVersion: "0.1.0-rc.8", state: "ready", packageVersion: "0.7.0", receipt: null },
  }), /registry unavailable/u);
  assert.equal(calls.some(([executable]) => executable === "dsh"), false);
});
