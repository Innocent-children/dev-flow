import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as commands from './commands.mjs';

const rl = readline.createInterface({ input, output });

async function askChoice(question, choices) {
  console.log(`\n? ${question}`);
  choices.forEach((c, idx) => {
    console.log(`  ${idx + 1}) ${c.label}`);
  });
  
  while (true) {
    const answer = await rl.question('Enter number: ');
    const num = parseInt(answer.trim(), 10);
    if (num >= 1 && num <= choices.length) {
      return choices[num - 1].value;
    }
    console.log('Invalid choice, try again.');
  }
}

export async function startTUI() {
  console.log('Welcome to Dev Flow CLI Manager');
  
  const action = await askChoice('What would you like to do?', [
    { label: 'Check environment status', value: 'status' },
    { label: 'Install an adapter', value: 'install' },
    { label: 'Upgrade an adapter', value: 'upgrade' },
    { label: 'Uninstall an adapter', value: 'uninstall' },
    { label: 'Clean local data', value: 'clean' },
    { label: 'Exit', value: 'exit' }
  ]);

  if (action === 'exit') {
    rl.close();
    return;
  }

  if (action === 'status') {
    commands.showStatus();
    rl.close();
    return;
  }

  if (action === 'clean') {
    const confirm = await askChoice('This will delete all SQLite tasks and configuration. Are you sure?', [
      { label: 'No, abort', value: 'no' },
      { label: 'Yes, delete', value: 'yes' }
    ]);
    if (confirm === 'yes') {
      commands.cleanData(true);
    }
    rl.close();
    return;
  }

  const target = await askChoice('Which adapter?', [
    { label: 'Codex', value: 'codex' },
    { label: 'DeepSeek', value: 'deepseek' }
  ]);

  let profile = 'web';
  if (target === 'deepseek') {
    const profileAns = await rl.question('Enter DSH profile name (default: web): ');
    if (profileAns.trim()) {
      profile = profileAns.trim();
    }
  }

  if (action === 'install') {
    if (target === 'codex') commands.installCodex();
    else commands.installDeepSeek(profile);
  } else if (action === 'upgrade') {
    commands.upgradeAdapter(target, profile);
  } else if (action === 'uninstall') {
    if (target === 'codex') commands.uninstallCodex();
    else commands.uninstallDeepSeek(profile);
  }

  rl.close();
}
