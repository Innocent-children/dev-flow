import { join, win32 } from "node:path";
export const runtimeKey = "win32-x64";
export const runtimeExecutable = "taskbelay.exe";
export const forwardedSignals = ["SIGINT", "SIGTERM"];
export const homeDirectory = (environment, fallback) => environment.USERPROFILE || environment.HOME || fallback;
export function productRoot(environment, home) { return join(environment.LOCALAPPDATA || join(home, "AppData", "Local"), "taskbelay"); }
export const nativeGitPath = value => win32.normalize(value);
