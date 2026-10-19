import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, parseArgs, writeArtifacts } from './apk-manifest.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'apk-manifest.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'fonte-apk-'));
const apkPath = path.join(dir, 'app-release.apk');
const APK = Buffer.from('apk de mentira para o teste');
writeFileSync(apkPath, APK);
const SHA = createHash('sha256').update(APK).digest('hex');

after(() => rmSync(dir, { recursive: true, force: true }));

describe('buildManifest', () => {
  test('calcula versionCode, tamanho e sha256', () => {
    assert.deepEqual(buildManifest({ version: '1.2.3', apk: APK, builtAt: 'agora' }), {
      version: '1.2.3',
      versionCode: 10203,
      sizeBytes: APK.length,
      sha256: SHA,
      builtAt: 'agora',
    });
  });

  test('versão fora da faixa do versionCode lança', () => {
    assert.throws(() => buildManifest({ version: '1.100.0', apk: APK, builtAt: 'x' }), /< 100/);
  });
});

describe('parseArgs', () => {
  test('lê os três parâmetros', () => {
    assert.deepEqual(parseArgs(['--apk', 'a.apk', '--version', '1.0.0', '--out', 'o']), {
      apk: 'a.apk',
      version: '1.0.0',
      out: 'o',
    });
  });

  test('parâmetro desconhecido ou sem valor lança', () => {
    assert.throws(() => parseArgs(['--apk']), /Uso:/);
    assert.throws(() => parseArgs(['--push', 'x']), /Uso:/);
  });

  test('parâmetro obrigatório ausente lança', () => {
    assert.throws(() => parseArgs(['--apk', 'a.apk', '--version', '1.0.0']), /--out/);
  });
});

describe('writeArtifacts', () => {
  test('copia o APK versionado e grava o latest.json', () => {
    const out = path.join(dir, 'downloads');
    const manifest = writeArtifacts(
      { apk: apkPath, version: '1.0.0', out },
      { now: new Date('2026-10-19T12:00:00Z') },
    );
    assert.equal(manifest.builtAt, '2026-10-19T12:00:00.000Z');
    assert.deepEqual(readFileSync(path.join(out, 'ops-1.0.0.apk')), APK);
    assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'latest.json'), 'utf8')), manifest);
  });

  test('usa a data atual por padrão', () => {
    const manifest = writeArtifacts({ apk: apkPath, version: '1.0.1', out: path.join(dir, 'd2') });
    assert.ok(!Number.isNaN(Date.parse(manifest.builtAt)));
  });

  test('CLI grava os artefatos e falha com código 1 sem parâmetros', () => {
    const out = path.join(dir, 'cli');
    const stdout = execFileSync(
      process.execPath,
      [CLI, '--apk', apkPath, '--version', '1.0.2', '--out', out],
      { encoding: 'utf8' },
    );
    assert.equal(JSON.parse(stdout).sha256, SHA);
    assert.throws(
      () => execFileSync(process.execPath, [CLI], { stdio: 'pipe' }),
      (error) => error.status === 1,
    );
  });
});
