// macOS retains its current executable replacement behavior.
export async function prepareReplacement() {}
export async function prepareInstallation() { return false; }
export async function runtimeForAction(action, _paths, _environment, runtimes) {
  return runtimes.find(entry => entry.host === action.host && entry.profile === (action.profile ?? null));
}
