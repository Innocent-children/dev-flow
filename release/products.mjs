export const releaseProducts = Object.freeze({
  codex: {
    packageName: "dev-flow-codex",
    tagPrefix: "codex-v",
    releaseName: "Dev Flow for Codex",
    guideName: "Codex guide",
    guidePath: "packages/codex/README.md",
    bundlesCore: true,
  },
  deepseek: {
    packageName: "dev-flow-deepseek",
    tagPrefix: "deepseek-v",
    releaseName: "Dev Flow for DeepSeek Harness",
    guideName: "DeepSeek Harness guide",
    guidePath: "packages/deepseek/README.md",
    bundlesCore: true,
  },
  claude: {
    packageName: "dev-flow-claude",
    tagPrefix: "claude-v",
    releaseName: "Dev Flow for Claude Code",
    guideName: "Claude Code guide",
    guidePath: "packages/claude/README.md",
    bundlesCore: true,
  },
  zcode: {
    packageName: "dev-flow-zcode",
    tagPrefix: "zcode-v",
    releaseName: "Dev Flow for ZCode",
    guideName: "ZCode guide",
    guidePath: "packages/zcode/README.md",
    bundlesCore: true,
  },
  "dev-flow": {
    packageName: "@imotong/dev-flow",
    tagPrefix: "dev-flow-v",
    releaseName: "Dev Flow CLI",
    guideName: "lifecycle CLI guide",
    guidePath: "packages/dev-flow/README.md",
    bundlesCore: false,
  },
});

export const HOST_PRODUCTS = Object.freeze(Object.keys(releaseProducts).filter(product => releaseProducts[product].bundlesCore));
