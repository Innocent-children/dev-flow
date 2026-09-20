import { createCodexDriver } from "./codex.mjs";
import { createDeepSeekDriver } from "./deepseek.mjs";
import { createClaudeDriver } from "./claude.mjs";

export function createHostDrivers({ paths, environment, localPackages = null,
  codexDriver, deepseekDriver, claudeDriver, runCodexChild, runDeepSeekChild, runClaudeChild } = {}) {
  return Object.freeze({
    codex: codexDriver ?? createCodexDriver({ paths, environment, run: runCodexChild, localPackage: localPackages?.codex ?? null }),
    claude: claudeDriver ?? createClaudeDriver({ paths, environment, run: runClaudeChild, localPackage: localPackages?.claude ?? null }),
    deepseek: deepseekDriver ?? createDeepSeekDriver({ paths, environment, run: runDeepSeekChild, localPackage: localPackages?.deepseek ?? null }),
  });
}
