import { spawn } from 'node:child_process';
import path from 'node:path';

const children = [
  spawn(
    process.execPath,
    [path.resolve('node_modules/tsx/dist/cli.mjs'), 'watch', 'server/index.ts'],
    { stdio: 'inherit' },
  ),
  spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit' }),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    child.kill();
  }

  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`Development process exited (${signal ?? code}).`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
