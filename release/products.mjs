export const releaseProducts = Object.freeze({
  codex: {
    packageName: "taskbelay-codex",
    tagPrefix: "codex-v",
    releaseName: "TaskBelay for Codex",
    guideName: "Codex guide",
    guidePath: "packages/codex/README.md",
    bundlesCore: true,
  },
  deepseek: {
    packageName: "taskbelay-deepseek",
    tagPrefix: "deepseek-v",
    releaseName: "TaskBelay for DeepSeek Harness",
    guideName: "DeepSeek Harness guide",
    guidePath: "packages/deepseek/README.md",
    bundlesCore: true,
  },
  claude: {
    packageName: "taskbelay-claude",
    tagPrefix: "claude-v",
    releaseName: "TaskBelay for Claude Code",
    guideName: "Claude Code guide",
    guidePath: "packages/claude/README.md",
    bundlesCore: true,
  },
  zcode: {
    packageName: "taskbelay-zcode",
    tagPrefix: "zcode-v",
    releaseName: "TaskBelay for ZCode",
    guideName: "ZCode guide",
    guidePath: "packages/zcode/README.md",
    bundlesCore: true,
  },
  "taskbelay": {
    packageName: "@imotong/taskbelay",
    tagPrefix: "taskbelay-v",
    releaseName: "TaskBelay CLI",
    guideName: "lifecycle CLI guide",
    guidePath: "packages/taskbelay/README.md",
    bundlesCore: false,
  },
});

export const HOST_PRODUCTS = Object.freeze(Object.keys(releaseProducts).filter(product => releaseProducts[product].bundlesCore));
