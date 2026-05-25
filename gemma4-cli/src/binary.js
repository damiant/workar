import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BIN_DIR, ensureDirs } from './paths.js';
import { download } from './download.js';
import { unzip } from './unzip.js';
import { untar } from './untar.js';

const RELEASES_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest';

function assetPattern() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin' && a === 'arm64') return /^llama-.*-bin-macos-arm64\.tar\.gz$/;
  if (p === 'darwin' && a === 'x64')   return /^llama-.*-bin-macos-x64\.tar\.gz$/;
  if (p === 'linux' && a === 'x64')    return /^llama-.*-bin-ubuntu-x64\.tar\.gz$/;
  if (p === 'linux' && a === 'arm64')  return /^llama-.*-bin-ubuntu-arm64\.tar\.gz$/;
  if (p === 'win32' && a === 'x64')    return /^llama-.*-bin-win-cpu-x64\.zip$/;
  if (p === 'win32' && a === 'arm64')  return /^llama-.*-bin-win-cpu-arm64\.zip$/;
  throw new Error(`No prebuilt llama-cli binary for ${p}/${a}. Set LLAMA_BINARY=/path/to/llama-cli to use a local build.`);
}

function binName() {
  return process.platform === 'win32' ? 'llama-cli.exe' : 'llama-cli';
}

function isTarGz(name) {
  return name.endsWith('.tar.gz');
}

async function fetchLatestAsset() {
  const headers = { 'user-agent': 'gemma4-cli' };
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
  if (process.env.LLAMA_BINARY) return process.env.LLAMA_BINARY;

  ensureDirs();
  const installed = findBinary(BIN_DIR);
  if (installed) return installed;

  process.stderr.write('Downloading llama-cli binary...\n');
  const { url, name } = await fetchLatestAsset();
  const archivePath = path.join(BIN_DIR, name);
  await download(url, archivePath, { label: name });

  if (isTarGz(name)) {
    untar(archivePath, BIN_DIR);
  } else {
    unzip(archivePath, BIN_DIR);
  }
  fs.unlinkSync(archivePath);

  const bin = findBinary(BIN_DIR);
  if (!bin) throw new Error('llama-cli binary not found in extracted archive');
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
  process.stderr.write('✓ Downloaded llama-cli binary.\n');
  return bin;
}
