import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BIN_DIR, ensureDirs } from './paths.js';
import { download } from './download.js';
import { unzip } from './unzip.js';

const RELEASES_API = 'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest';

function assetPattern() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin' && a === 'arm64') return /^sd-master-.*-bin-Darwin-macOS-.*-arm64\.zip$/;
  if (p === 'linux' && a === 'x64')   return /^sd-master-.*-bin-Linux-Ubuntu-[\d.]+-x86_64\.zip$/;
  if (p === 'win32' && a === 'x64')   return /^sd-master-.*-bin-win-avx2-x64\.zip$/;
  throw new Error(`No prebuilt sd binary for ${p}/${a}. Set SD_BINARY=/path/to/sd to use a local build.`);
}

function binName() {
  return process.platform === 'win32' ? 'sd-cli.exe' : 'sd-cli';
}

async function fetchLatestAsset() {
  const headers = { 'user-agent': 'flux2-cli' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(RELEASES_API, { headers });
  if (!res.ok) throw new Error(`GitHub releases API failed: ${res.status}`);
  const json = await res.json();
  const pat = assetPattern();
  const asset = json.assets.find(a => pat.test(a.name));
  if (!asset) throw new Error(`No matching asset for ${process.platform}/${process.arch} in ${json.tag_name}`);
  return { url: asset.browser_download_url, name: asset.name, tag: json.tag_name };
}

function findBinary(root) {
  const target = binName();
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === target) return full;
    }
  }
  return null;
}

export async function resolveBinary() {
  if (process.env.SD_BINARY) return process.env.SD_BINARY;

  ensureDirs();
  const installed = findBinary(BIN_DIR);
  if (installed) return installed;

  process.stderr.write('Installing stable-diffusion.cpp...\n');
  const { url, name } = await fetchLatestAsset();
  const zipPath = path.join(BIN_DIR, name);
  await download(url, zipPath, { label: name });
  unzip(zipPath, BIN_DIR);
  fs.unlinkSync(zipPath);

  const bin = findBinary(BIN_DIR);
  if (!bin) throw new Error('sd binary not found in extracted archive');
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
  return bin;
}
