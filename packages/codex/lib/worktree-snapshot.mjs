import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The Host stores a Git snapshot without changing HEAD, the source index or refs/stash.
// The supplied runner owns process execution and platform policy.
export async function captureWorkspaceChanges(root, run) {
  const git = async (args, env = {}) => String(await run(root, args, env)).trim();
  const head = await git(["rev-parse", "HEAD"]);
  const status = await git(["status", "--porcelain=v2", "--untracked-files=all"]);
  if (!status) return null;
  if (status.split("\n").some((row) => row.startsWith("u ") || /^[12] \S+ S/u.test(row))) {
    throw new Error("Resolve conflicts and submodule changes before carrying workspace changes");
  }
  const identity = ["-c", "user.name=Dev Flow", "-c", "user.email=dev-flow@localhost"];
  const tracked = await git([...identity, "stash", "create"]);
  const indexTree = await git(["rev-parse", tracked ? `${tracked}^2^{tree}` : `${head}^{tree}`]);
  const worktreeTree = await git(["rev-parse", tracked ? `${tracked}^{tree}` : `${head}^{tree}`]);
  const indexCommit = await git([...identity, "commit-tree", indexTree, "-p", head, "-m", "Dev Flow workspace index snapshot"]);
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
    const untrackedCommit = await git([...identity, "commit-tree", untrackedTree, "-m", "Dev Flow untracked snapshot"]);
    if (head !== await git(["rev-parse", "HEAD"]) || status !== await git(["status", "--porcelain=v2", "--untracked-files=all"])) {
      throw new Error("Source workspace changed while capturing its contents; confirm again");
    }
    return await git([...identity, "commit-tree", worktreeTree, "-p", head, "-p", indexCommit, "-p", untrackedCommit, "-m", "Dev Flow workspace snapshot"]);
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
