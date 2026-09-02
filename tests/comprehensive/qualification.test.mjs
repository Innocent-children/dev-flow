import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const commands = parseQualificationCommands(process.env.DEV_FLOW_QUALIFICATION_COMMANDS);

test("local deterministic large-change qualification", {
  skip: process.env.DEV_FLOW_RUN_LOCAL_QUALIFICATION === "1" ? false : "set DEV_FLOW_RUN_LOCAL_QUALIFICATION=1",
}, async () => {
  for (const command of [
    ["go", "test", "-count=1", "./..."],
    ["pnpm", "--dir", "packages/codex", "test"],
    ["pnpm", "--dir", "packages/deepseek", "test"],
    ["pnpm", "--dir", "packages/dev-flow", "test"],
    ["pnpm", "--dir", "packages/webui", "build"],
  ]) {
    const result = await run(command[0], command.slice(1));
    assert.equal(result.code, 0, `${command.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
});

for (const name of ["codex", "deepseek", "windows", "webui", "nightly"]) {
  test(`external qualification: ${name}`, { skip: commands[name] === undefined ? `set DEV_FLOW_QUALIFICATION_COMMANDS.${name}` : false }, async () => {
    const command = commands[name];
    assert.ok(Array.isArray(command) && command.length > 0 && command.every((item) => typeof item === "string" && item.length > 0));
    const result = await run(command[0], command.slice(1));
    assert.equal(result.code, 0, `${name} qualification failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  });
}

function parseQualificationCommands(raw) {
  if (raw === undefined || raw.trim() === "") {
    return {};
  }
  const value = JSON.parse(raw);
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  for (const name of Object.keys(value)) {
    assert.ok(["codex", "deepseek", "windows", "webui", "nightly"].includes(name), `unknown qualification ${name}`);
  }
  return value;
}

function run(executable, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: new URL("../..", import.meta.url),
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
