#!/usr/bin/env node
// Monta o conteúdo da imagem fonte-apk (story 213): copia o APK assinado para
// `<out>/ops-<versão>.apk` e grava `<out>/latest.json`, que é o que a home do
// release.fonte lê para anunciar o download.
//
//   node scripts/release/apk-manifest.mjs --apk <app-release.apk> --version 1.2.0 --out <dir>
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
// Mesma função usada pelo app.config.js do ops: o versionCode publicado é,
// por construção, o que está dentro do APK.
const { versionCode } = require('../../apps/ops.fonte/config/version.js');

export function buildManifest({ version, apk, builtAt }) {
  return {
    version,
    versionCode: versionCode(version),
    sizeBytes: apk.length,
    sha256: createHash('sha256').update(apk).digest('hex'),
    builtAt,
  };
}

export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!['--apk', '--version', '--out'].includes(key) || !value) {
      throw new Error(`Uso: --apk <arquivo> --version <X.Y.Z> --out <dir> (recebido "${key}")`);
    }
    options[key.slice(2)] = value;
  }
  for (const required of ['apk', 'version', 'out']) {
    if (!options[required]) throw new Error(`Parâmetro obrigatório ausente: --${required}`);
  }
  return options;
}

export function writeArtifacts({ apk: apkPath, version, out }, { now = new Date() } = {}) {
  const apk = readFileSync(apkPath);
  const manifest = buildManifest({ version, apk, builtAt: now.toISOString() });
  mkdirSync(out, { recursive: true });
  copyFileSync(apkPath, path.join(out, `ops-${version}.apk`));
  writeFileSync(path.join(out, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/* node:coverage ignore next 9 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = writeArtifacts(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
  } catch (error) {
    process.stderr.write(`[release:apk-manifest] ${error.message}\n`);
    process.exitCode = 1;
  }
}
