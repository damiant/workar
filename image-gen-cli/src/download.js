import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

function fmtBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export async function download(url, dest, { label } = {}) {
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const tmp = `${dest}.part`;
  const headers = {};
  if (process.env.HF_TOKEN && url.includes('huggingface.co')) {
    headers.authorization = `Bearer ${process.env.HF_TOKEN}`;
  }

  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);

  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  let lastPrint = 0;
  const tag = label || path.basename(dest);

  const reporter = new WritableProgress((chunk) => {
    got += chunk.length;
    const now = Date.now();
    if (now - lastPrint > 200 || got === total) {
      lastPrint = now;
      const pct = total ? ((got / total) * 100).toFixed(1) + '%' : '';
      process.stderr.write(`\r  ${tag}: ${fmtBytes(got)}${total ? ' / ' + fmtBytes(total) : ''} ${pct}   `);
    }
  });

  await pipeline(res.body, reporter, fs.createWriteStream(tmp));
  process.stderr.write('\n');
  fs.renameSync(tmp, dest);
  return dest;
}

import { Transform } from 'node:stream';
class WritableProgress extends Transform {
  constructor(onChunk) {
    super();
    this.onChunk = onChunk;
  }
  _transform(chunk, _enc, cb) {
    this.onChunk(chunk);
    cb(null, chunk);
  }
}
