import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTag, run } from './check-tag.mjs';
import { createRepo } from './test-repo.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-tag.mjs');

describe('checkTag', () => {
  const exists = (files) => (file) => files.includes(file);

  test('tag que bate com o package.json e tem changelog passa', () => {
    assert.deepEqual(
      checkTag({ tag: 'v1.2.0', opsVersion: '1.2.0', releaseFileExists: exists(['v1.2.0.md']) }),
      [],
    );
  });

  test('aceita pré-release', () => {
    assert.deepEqual(
      checkTag({
        tag: 'v0.0.0-rc.1',
        opsVersion: '0.0.0-rc.1',
        releaseFileExists: exists(['v0.0.0-rc.1.md']),
      }),
      [],
    );
  });

  test('tag que não bate com o package.json falha', () => {
    const problems = checkTag({
      tag: 'v1.3.0',
      opsVersion: '1.2.0',
      releaseFileExists: exists(['v1.3.0.md']),
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /não bate com apps\/ops\.fonte\/package\.json/);
  });

  test('sem changelog falha', () => {
    const problems = checkTag({ tag: 'v1.2.0', opsVersion: '1.2.0', releaseFileExists: exists([]) });
    assert.match(problems[0], /Changelog ausente: apps\/release\.fonte\/content\/releases\/v1\.2\.0\.md/);
  });

  test('tag fora do formato falha', () => {
    assert.match(checkTag({ tag: '1.2.0', opsVersion: '1.2.0', releaseFileExists: () => true })[0], /vX\.Y\.Z/);
    assert.match(checkTag({ tag: undefined, opsVersion: '1.2.0', releaseFileExists: () => true })[0], /vX\.Y\.Z/);
  });
});

describe('check-tag no disco', () => {
  const repo = createRepo({ opsVersion: '1.0.0' });
  repo.write('apps/release.fonte/content/releases/v1.0.0.md', '---\nversion: 1.0.0\n---\n');
  after(() => repo.cleanup());

  test('run lê package.json e o diretório de releases', () => {
    assert.deepEqual(run('v1.0.0', { cwd: repo.dir }), []);
    assert.equal(run('v1.1.0', { cwd: repo.dir }).length, 2);
  });

  test('CLI: ok sai 0, divergência sai 1', () => {
    const ok = execFileSync(process.execPath, [CLI, 'v1.0.0'], { cwd: repo.dir, encoding: 'utf8' });
    assert.match(ok, /v1\.0\.0 ok/);
    assert.throws(
      () => execFileSync(process.execPath, [CLI, 'v9.0.0'], { cwd: repo.dir, stdio: 'pipe' }),
      (error) => error.status === 1 && /não bate/.test(String(error.stderr)),
    );
  });
});
