import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const venvPython = join(
  root,
  'backend',
  '.venv',
  ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']),
);
const candidates = [
  ...(existsSync(venvPython) ? [[venvPython]] : []),
  ...(process.platform === 'win32'
    ? [['python'], ['py', '-3']]
    : [['python3'], ['python']]),
];

for (const [command, ...args] of candidates) {
  const result = spawnSync(command, [...args, join(root, 'scripts', 'generate-python-api-docs.py')], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.error?.code === 'ENOENT') continue;
  if (result.error) {
    console.error(`Could not start Python: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

console.error('Python 3 was not found. Install Python or create backend/.venv.');
process.exit(1);
