import type { ServerApi } from './api.js';
import type { Runner } from './runner.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLoop(
  api: ServerApi,
  runner: Runner,
  timeoutMs: number,
): Promise<never> {
  console.log('tarsk-server: starting work loop');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let work: Record<string, unknown>;
    try {
      const result = await api.deque(true);
      if (!result.ok || !result.work) continue;
      work = result.work;
    } catch (err) {
      console.error('deque error:', err);
      await sleep(2_000);
      continue;
    }

    console.log(`processing work ${work['workId']} (type: ${work['type']})`);
    try {
      const { contentType, bytes } = await runner.run(work, timeoutMs);
      const contentBase64 = bytes.toString('base64');
      await api.complete(work['workId'] as string, contentType, contentBase64, false);
      console.log(`completed work ${work['workId']}`);
    } catch (err) {
      console.error(`work ${work['workId']} failed:`, err);
      const errJson = JSON.stringify({ type: 'error', message: String(err) });
      const contentBase64 = Buffer.from(errJson).toString('base64');
      try {
        await api.complete(work['workId'] as string, 'application/json', contentBase64, true);
      } catch (err2) {
        console.error('complete (error) failed:', err2);
      }
    }
  }
}
