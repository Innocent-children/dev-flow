// Generated from packages/host-workspace/worktree-snapshot.mjs; edit the shared source.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const snapshotIdentity = ["-c", "user.name=Dev Flow", "-c", "user.email=dev-flow@localhost"];

// The Host stores a Git snapshot without changing HEAD, the source index or refs/stash.
// The supplied runner owns process execution and platform policy.
export async function captureWorkspaceChanges(root, run) {
  const before = await readWorkspaceTrees(root, run);
  const after = await readWorkspaceTrees(root, run);
  if (["head", "indexTree", "worktreeTree", "untrackedTree"].some(field => before[field] !== after[field])) {
    throw new Error("Source workspace changed while capturing its contents; confirm again");
  }
  if (!before.changed) return null;
  const git = async args => String(await run(root, args, {})).trim();
  const indexCommit = await git([...snapshotIdentity, "commit-tree", before.indexTree, "-p", before.head, "-m", "Dev Flow workspace index snapshot"]);
  const untrackedCommit = await git([...snapshotIdentity, "commit-tree", before.untrackedTree, "-m", "Dev Flow untracked snapshot"]);
  return await git([...snapshotIdentity, "commit-tree", before.worktreeTree, "-p", before.head, "-p", indexCommit, "-p", untrackedCommit, "-m", "Dev Flow workspace snapshot"]);
}

async function readWorkspaceTrees(root, run) {
  const git = async (args, env = {}) => String(await run(root, args, env)).trim();
  const head = await git(["rev-parse", "HEAD"]);
  const status = await git(["status", "--porcelain=v2", "--untracked-files=all"]);
  if (status.split("\n").some((row) => row.startsWith("u ") || /^[12] \S+ S/u.test(row))) {
    throw new Error("Resolve conflicts and submodule changes before carrying workspace changes");
  }
  const tracked = status ? await git([...snapshotIdentity, "stash", "create"]) : "";
  const indexTree = await git(["rev-parse", tracked ? `${tracked}^2^{tree}` : `${head}^{tree}`]);
  const worktreeTree = await git(["rev-parse", tracked ? `${tracked}^{tree}` : `${head}^{tree}`]);
  const directory = await mkdtemp(join(tmpdir(), "dev-flow-snapshot-"));
  try {
    const names = await run(root, ["ls-files", "--others", "--exclude-standard", "-z"], {});
    const env = { GIT_INDEX_FILE: join(directory, "index") };
    await git(["read-tree", "--empty"], env);
    if (String(names).length) {
      const paths = join(directory, "paths");
      await writeFile(paths, names, { mode: 0o600 });
      await git(["--literal-pathspecs", "add", `--pathspec-from-file=${paths}`, "--pathspec-file-nul"], env);
    }
    const untrackedTree = await git(["write-tree"], env);
    return { head, indexTree, worktreeTree, untrackedTree, changed: status !== "" };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function applyWorkspaceChanges(root, snapshot, run) {
  if (snapshot === null) return;
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(snapshot)) throw new Error("Invalid workspace snapshot commit");
  try {
    await run(root, ["stash", "apply", "--index", snapshot], {});
  } catch (cause) {
    throw new Error("Workspace changes could not be applied; inspect the retained worktree. No Core Task was created", { cause });
  }
}
