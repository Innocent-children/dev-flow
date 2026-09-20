import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workflow = (await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const packages = ["codex", "deepseek", "dev-flow"];
const windowsStart = workflow.indexOf("  windows-x64:\n");
assert.notEqual(windowsStart, -1, "Windows CI job is required");
const remaining = workflow.slice(windowsStart + "  windows-x64:\n".length);
const nextJob = remaining.search(/^  [\w-]+:\n/mu);
const windows = nextJob === -1 ? remaining : remaining.slice(0, nextJob);
const steps = windows.split(/^      - name: /mu).slice(1);

function packageStep(product) {
  const matches = steps.filter(step => step.includes(`          pnpm --dir packages/${product} test\n`));
  assert.equal(matches.length, 1, `${product} must have exactly one package test step`);
  const step = matches[0];
  assert.match(step, /^        shell: pwsh$/mu);
  assert.doesNotMatch(step, /^        (?:if|continue-on-error):/mu);
  const run = step.match(/^        run: \|\n((?:          [^\n]*\n)+)/mu)?.[1];
  assert.ok(run, `${product} needs an explicit PowerShell run block`);
  return { step, run: run.replace(/^          /gmu, "") };
}

test("Windows package suites have independent mandatory steps and explicit exit statuses", () => {
  assert.doesNotMatch(windows, /^    continue-on-error:/mu);
  const selected = packages.map(packageStep);
  assert.equal(new Set(selected.map(value => value.step)).size, packages.length);
  for (const { run } of selected) {
    assert.equal([...run.matchAll(/^pnpm --dir packages\/[^\n]+ test$/gmu)].length, 1);
    assert.match(run, /^exit \$LASTEXITCODE\n?$/mu);
  }
});

test("actual Windows CI step bodies preserve each native failure and allow success", {
  skip: process.platform !== "win32" ? "requires native PowerShell on Windows" : false,
}, async t => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-ci-exit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const command = join(root, "pnpm-test.mjs");
  const calls = join(root, "calls.jsonl");
  // Only the package executable is substituted. Run the checked-in step bodies
  // in real PowerShell, with a native Node process supplying the exit status.
  await writeFile(command, `import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.DEV_FLOW_CI_TEST_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');\nprocess.exit(Number(process.env.DEV_FLOW_CI_TEST_EXIT));\n`);
  await writeFile(join(root, "pnpm.ps1"), "& $env:DEV_FLOW_CI_TEST_NODE $env:DEV_FLOW_CI_TEST_COMMAND @args\nexit $LASTEXITCODE\n");
  const environment = { ...process.env };
  const pathKey = Object.keys(environment).find(key => key.toUpperCase() === "PATH") ?? "PATH";
  environment[pathKey] = `${root};${environment[pathKey] ?? ""}`;
  environment.DEV_FLOW_CI_TEST_NODE = process.execPath;
  environment.DEV_FLOW_CI_TEST_COMMAND = command;
  environment.DEV_FLOW_CI_TEST_CALLS = calls;

  for (const product of packages) {
    const script = join(root, `${product}.ps1`);
    await writeFile(script, `$ErrorActionPreference = 'Stop'\n${packageStep(product).run}`);
    for (const code of [7, 0]) {
      await t.test(`${product}: native exit ${code}`, async () => {
        await writeFile(calls, "");
        let actualCode;
        try {
          await execFile("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
            cwd: root, env: { ...environment, DEV_FLOW_CI_TEST_EXIT: String(code) }, encoding: "utf8", windowsHide: true, timeout: 15000,
          });
          actualCode = 0;
        } catch (error) {
          assert.equal(error.killed, false, error.message);
          assert.equal(error.signal, null, error.message);
          actualCode = error.code;
        }
        assert.equal(actualCode, code, `${product} step masked the native exit status`);
        const invoked = (await readFile(calls, "utf8")).trim().split("\n").map(line => JSON.parse(line));
        assert.deepEqual(invoked, [["--dir", `packages/${product}`, "test"]]);
      });
    }
  }
});
