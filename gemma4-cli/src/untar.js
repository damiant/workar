import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Extract a .tar.gz archive (gzip-compressed tar) into outDir.
 * Pure-Node implementation — zero dependencies.
 *
 * Only regular files and directories are extracted; symlinks are skipped.
 */
export function untar(tarGzPath, outDir) {
  const compressed = fs.readFileSync(tarGzPath);
  const buf = zlib.gunzipSync(compressed);
  fs.mkdirSync(outDir, { recursive: true });

  let offset = 0;
  while (offset + 512 <= buf.length) {
    // Parse 512-byte header
    const header = buf.subarray(offset, offset + 512);

    // Two consecutive zero blocks signal end of archive
    if (header.every((b) => b === 0)) break;

    const nameRaw = header.subarray(0, 100).toString('utf8').replace(/\0/g, '');
    const typeFlag = String.fromCharCode(header[156]);
    const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0/g, '').trim();
    const modeOctal = header.subarray(100, 108).toString('utf8').replace(/\0/g, '').trim();
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0/g, '');

    // Compute size
    const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;

    // Handle GNU extension for large names (type 'L')
    // For simplicity we skip special types and just handle files/dirs
    let entryName = prefix ? `${prefix}/${nameRaw}` : nameRaw;

    // Skip pax extended headers and other special entries
    if (typeFlag === 'x' || typeFlag === 'g' || typeFlag === 'L' || typeFlag === 'K') {
      offset += 512 + Math.ceil(size / 512) * 512;
      continue;
    }

    if (entryName.includes('..')) throw new Error(`Refusing unsafe path: ${entryName}`);

    const dest = path.join(outDir, entryName);
    const dataOffset = offset + 512;
    const dataBlocks = Math.ceil(size / 512) * 512;

    if (typeFlag === '5' || entryName.endsWith('/')) {
      // Directory
      fs.mkdirSync(dest, { recursive: true });
    } else if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '7') {
      // Regular file
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const fileData = buf.subarray(dataOffset, dataOffset + size);
      fs.writeFileSync(dest, fileData);

      // Restore permissions
      if (modeOctal) {
        const mode = parseInt(modeOctal, 8);
        if (mode) {
          try { fs.chmodSync(dest, mode & 0o7777); } catch {}
        }
      }
    }
    // Symlinks (typeFlag === '2') and other types are silently skipped

    offset += 512 + dataBlocks;
  }
}
