import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIG_EOCD   = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_CDH    = 0x02014b50;
const SIG_LFH    = 0x04034b50;

function findEocd(buf) {
  const max = Math.min(buf.length, 0xffff + 22);
  for (let i = buf.length - 22; i >= buf.length - max; i--) {
    if (i < 0) break;
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new Error('Not a zip file (no EOCD record)');
}

function readCentralDirectory(buf) {
  const eocd = findEocd(buf);
  let entries  = buf.readUInt16LE(eocd + 10);
  let cdSize   = buf.readUInt32LE(eocd + 12);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  // ZIP64 fallback for large archives
  if (cdOffset === 0xffffffff || entries === 0xffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (buf.readUInt32LE(i) === SIG_EOCD64) {
        entries  = Number(buf.readBigUInt64LE(i + 32));
        cdSize   = Number(buf.readBigUInt64LE(i + 40));
        cdOffset = Number(buf.readBigUInt64LE(i + 48));
        break;
      }
    }
  }

  const out = [];
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== SIG_CDH) throw new Error('Bad central directory header');
    const method     = buf.readUInt16LE(p + 10);
    const compSize   = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen    = buf.readUInt16LE(p + 28);
    const extraLen   = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const extAttr    = buf.readUInt32LE(p + 38);
    const localOff   = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    out.push({ name, method, compSize, uncompSize, localOff, extAttr });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function entryData(buf, entry) {
  const p = entry.localOff;
  if (buf.readUInt32LE(p) !== SIG_LFH) throw new Error(`Bad local header for ${entry.name}`);
  const nameLen  = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.slice(start, start + entry.compSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Unsupported compression method ${entry.method} for ${entry.name}`);
}

export function unzip(zipPath, outDir) {
  const buf = fs.readFileSync(zipPath);
  const entries = readCentralDirectory(buf);
  fs.mkdirSync(outDir, { recursive: true });

  for (const entry of entries) {
    if (entry.name.includes('..')) throw new Error(`Refusing unsafe path: ${entry.name}`);
    const dest = path.join(outDir, entry.name);

    if (entry.name.endsWith('/')) {
      fs.mkdirSync(dest, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const data = entryData(buf, entry);
    fs.writeFileSync(dest, data);

    // Restore unix permissions from external attrs (high 16 bits)
    const unixMode = (entry.extAttr >>> 16) & 0xffff;
    if (unixMode) {
      try { fs.chmodSync(dest, unixMode & 0o7777); } catch {}
    }
  }
}
