import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/json': 'json',
  'text/plain': 'txt',
};

function extFor(contentType: string): string {
  const base = contentType.split(';')[0].trim();
  return EXT_MAP[base] ?? 'bin';
}

export async function saveResult(
  result: { workId: string; contentType: string; bytes: Uint8Array; isError: boolean },
  outDir: string,
): Promise<string> {
  const ext = extFor(result.contentType);
  const filename = `work-${result.workId}.${ext}`;
  const filePath = path.join(outDir, filename);
  await writeFile(filePath, result.bytes);
  console.log(`I saved the result to "${filePath}"`);

  if (result.isError) {
    const errData = JSON.parse(new TextDecoder().decode(result.bytes)) as {
      message?: string;
    };
    console.error(`Error: ${errData.message ?? 'unknown error'}`);
  }

  return filePath;
}
