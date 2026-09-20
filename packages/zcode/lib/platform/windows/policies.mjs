import { join, win32 } from "node:path";

export const runtimeKey = "win32-x64";
export const runtimeExecutable = "dev-flow.exe";
export const forwardedSignals = ["SIGINT", "SIGTERM"];
export const homeDirectory = (environment, fallback) => environment.USERPROFILE || environment.HOME || fallback;
export const productRoot = (environment, home) => join(environment.LOCALAPPDATA || join(home, "AppData", "Local"), "dev-flow");
export const nativeGitPath = value => win32.normalize(value);
