import { spawn } from 'node:child_process';

export function runLlama(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`llama-cli exited with code ${code}`));
    });
  });
}
