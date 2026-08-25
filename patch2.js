const fs = require('fs');

function replaceBlock(file) {
  let c = fs.readFileSync(file, 'utf8');
  
  c = c.replace(/```bash\s+npm install -g @deepseek-ai\/dsh@latest\s+dsh --version\s+PROFILE=web\s+TARBALL="\$\(npm pack dev-flow-deepseek@latest --silent\)"\s+dsh plugin --profile "\$PROFILE" add "\$PWD\/\$TARBALL"\s+rm -f "\$PWD\/\$TARBALL"\s+dsh --profile "\$PROFILE" --dump-config\s+```/g, 
  '```bash\nnpx @dev-flow/cli install deepseek --profile web\n```');
  
  // also fix codex
  c = c.replace(/```bash\s+npx @dev-flow\/cli install codex\s+dev-flow-codex setup\s+dev-flow-codex --version\s+```/g,
  '```bash\nnpx @dev-flow/cli install codex\n```');

  fs.writeFileSync(file, c);
}

replaceBlock('README.md');
replaceBlock('README_en.md');
replaceBlock('packages/codex/README.md');
replaceBlock('packages/deepseek/README.md');
