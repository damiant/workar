import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Build an environment with the binary's directory added to the platform's
 * shared-library search path. This is needed because prebuilt binaries
 * (sd-cli, llama-cli) ship with sibling .dylib / .so files that the
 * executable references via @rpath / $ORIGIN.
 */
function spawnEnv(binary) {
  const env = { ...process.env };
  const binDir = path.dirname(binary);
  if (process.platform === 'darwin') {
    env.DYLD_LIBRARY_PATH = binDir + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : '');
  } else if (process.platform === 'linux') {
    env.LD_LIBRARY_PATH = binDir + (env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : '');
  }
  return env;
}

export function runSd(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit', env: spawnEnv(binary) });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sd exited with code ${code}`));
    });
  });
}
