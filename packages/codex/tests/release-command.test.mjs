import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  parseReleaseArguments,
  runReleaseCommand,
} from "../../../scripts/release-codex.mjs";

const execFile = promisify(execFileCallback);
const version = "0.4.0";

test("one-command release accepts exactly one output and exact confirmation", () => {
  assert.deepEqual(parseReleaseArguments([
    "--output", "/tmp/dev-flow-release-v0.4.0",
    "--confirm", "v0.4.0",
  ]), {
    outputDirectory: "/tmp/dev-flow-release-v0.4.0",
    confirmation: "v0.4.0",
  });

  for (const arguments_ of [
    [],
    ["--output", "/tmp/release"],
    ["--confirm", "v0.4.0"],
    ["--output", "/tmp/release", "--output", "/tmp/other", "--confirm", "v0.4.0"],
    ["--output", "/tmp/release", "--confirm", "v0.4.0", "--unknown", "value"],
  ]) {
    assert.throws(() => parseReleaseArguments(arguments_), /usage|only once|unknown argument/u);
  }
});

test("missing output prepares, verifies, and publishes in one ordered invocation", async (t) => {
  const scenario = await createScenario(t);
  const output = join(scenario.root, "release-v0.4.0");
  const calls = [];

  const result = await runReleaseCommand({
    repositoryRoot: scenario.repository,
    outputDirectory: output,
    confirmation: "v0.4.0",
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output }),
  });

  assert.equal(result.mode, "prepared-and-published");
  assert.equal(result.version, version);
  assert.deepEqual(calls.map((call) => call.label), ["prepare", "verify", "publish"]);
  assert.deepEqual(calls.at(-1).arguments.slice(-2), ["--confirm", "v0.4.0"]);
});

test("empty output prepares while an exact five-file output resumes publisher only", async (t) => {
  const empty = await createScenario(t);
  const emptyOutput = join(empty.root, "empty-release");
  await mkdir(emptyOutput);
  const preparedCalls = [];
  await runReleaseCommand({
    repositoryRoot: empty.repository,
    outputDirectory: emptyOutput,
    confirmation: "v0.4.0",
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(preparedCalls, { prepareOutput: emptyOutput }),
  });
  assert.deepEqual(preparedCalls.map((call) => call.label), ["prepare", "verify", "publish"]);

  const resumed = await createScenario(t);
  const resumedOutput = join(resumed.root, "resumed-release");
  await mkdir(resumedOutput);
  await writeReleaseFiles(resumedOutput);
  const resumedCalls = [];
  const result = await runReleaseCommand({
    repositoryRoot: resumed.repository,
    outputDirectory: resumedOutput,
    confirmation: "v0.4.0",
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(resumedCalls),
  });
  assert.equal(result.mode, "resumed-and-published");
  assert.deepEqual(resumedCalls.map((call) => call.label), ["publish"]);
});

test("invalid output, symlink, confirmation, version, dirty source, and unpushed source fail before children", async (t) => {
  const cases = [
    {
      name: "unexpected output",
      arrange: async (scenario) => {
        const output = join(scenario.root, "invalid-release");
        await mkdir(output);
        await writeFile(join(output, "unexpected.txt"), "invalid\n");
        return { output, expected: /exact five-file set/u };
      },
    },
    {
      name: "symlink output",
      arrange: async (scenario) => {
        const target = join(scenario.root, "real-release");
        const output = join(scenario.root, "linked-release");
        await mkdir(target);
        await symlink(target, output);
        return { output, expected: /symbolic link/u };
      },
    },
    {
      name: "confirmation mismatch",
      arrange: async (scenario) => ({ output: join(scenario.root, "confirmation-release"), confirmation: "v0.3.0", expected: /confirmation must equal v0\.4\.0/u }),
    },
    {
      name: "version mismatch",
      arrange: async (scenario) => {
        const path = join(scenario.repository, "packages", "deepseek", "package.json");
        const manifest = JSON.parse(await readFile(path, "utf8"));
        manifest.version = "0.3.0";
        await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
        return { output: join(scenario.root, "version-release"), expected: /version authorities must equal 0\.4\.0/u };
      },
    },
    {
      name: "dirty source",
      arrange: async (scenario) => {
        await writeFile(join(scenario.repository, "README.md"), "dirty\n");
        return { output: join(scenario.root, "dirty-release"), expected: /clean source checkout/u };
      },
    },
    {
      name: "unpushed source",
      arrange: async (scenario) => {
        await writeFile(join(scenario.repository, "README.md"), "unpushed\n");
        await git(scenario.repository, ["add", "README.md"]);
        await git(scenario.repository, ["commit", "-m", "unpushed"]);
        return { output: join(scenario.root, "unpushed-release"), expected: /HEAD must equal origin\/main/u };
      },
    },
  ];

  for (const candidate of cases) {
    await t.test(candidate.name, async (t) => {
      const scenario = await createScenario(t);
      const arranged = await candidate.arrange(scenario);
      const calls = [];
      await assert.rejects(runReleaseCommand({
        repositoryRoot: scenario.repository,
        outputDirectory: arranged.output,
        confirmation: arranged.confirmation ?? "v0.4.0",
        platform: "darwin",
        architecture: "arm64",
        runProcess: recordingRunner(calls),
      }), arranged.expected);
      assert.deepEqual(calls, []);
    });
  }
});

async function createScenario(t) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-release-command-test-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
  });
  const repository = join(root, "repository");
  const remote = join(root, "origin.git");
  await Promise.all([
    mkdir(join(repository, "packages", "codex", "plugin", ".codex-plugin"), { recursive: true }),
    mkdir(join(repository, "packages", "deepseek"), { recursive: true }),
    mkdir(join(repository, "scripts"), { recursive: true }),
  ]);
  await writeFile(join(repository, "VERSION"), `${version}\n`);
  await writeJSON(join(repository, "package.json"), { name: "dev-flow", version, private: true });
  await writeJSON(join(repository, "packages", "codex", "package.json"), { name: "dev-flow-codex", version, private: false });
  await writeJSON(join(repository, "packages", "codex", "plugin", ".codex-plugin", "plugin.json"), { name: "dev-flow-codex", version });
  await writeJSON(join(repository, "packages", "deepseek", "package.json"), { name: "dev-flow-deepseek", version, private: true });
  await writeFile(join(repository, "README.md"), "release command fixture\n");
  for (const name of ["build-codex-release.sh", "verify-codex-release.mjs", "publish-codex-release.mjs"]) {
    const path = join(repository, "scripts", name);
    await writeFile(path, "fixture\n");
    await chmod(path, 0o755);
  }
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote]);
  await git(repository, ["init", "--initial-branch=main"]);
  await git(repository, ["config", "user.name", "Dev Flow Release Test"]);
  await git(repository, ["config", "user.email", "release-test@example.invalid"]);
  await git(repository, ["add", "."]);
  await git(repository, ["commit", "-m", "fixture"]);
  await git(repository, ["remote", "add", "origin", remote]);
  await git(repository, ["push", "-u", "origin", "main"]);
  return { root, repository };
}

function recordingRunner(calls, { prepareOutput = null } = {}) {
  return async (executable, arguments_) => {
    const name = executable.split("/").at(-1);
    const label = name === "build-codex-release.sh"
      ? "prepare"
      : arguments_[0]?.endsWith("verify-codex-release.mjs")
        ? "verify"
        : "publish";
    calls.push({ label, executable, arguments: [...arguments_] });
    if (label === "prepare") await writeReleaseFiles(prepareOutput);
  };
}

async function writeReleaseFiles(directory) {
  const files = [
    "SHA256SUMS",
    `dev-flow-${version}-darwin-arm64`,
    `dev-flow-codex-${version}.tgz`,
    "publication-record.json",
    "release-manifest.json",
  ];
  await Promise.all(files.map((name) => writeFile(join(directory, name), `${name}\n`)));
}

async function writeJSON(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function git(repository, arguments_) {
  await execFile("git", arguments_, { cwd: repository });
}
