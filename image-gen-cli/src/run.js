import { spawn } from 'node:child_process';

export function runSd(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sd exited with code ${code}`));
    });
  });
}
