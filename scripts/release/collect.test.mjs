import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, main, parseArgs } from './collect.mjs';
import { lastTag, parseLog, readCommits } from './git.mjs';
import { createRepo } from './test-repo.mjs';

const COLLECT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'collect.mjs');

describe('parseArgs', () => {
  test('lê --from (duas formas), --markdown e --date', () => {
    assert.deepEqual(parseArgs([]), { from: null, markdown: false, date: null });
    assert.deepEqual(parseArgs(['--from', 'abc', '--markdown', '--date=2026-10-20']), {
      from: 'abc',
      markdown: true,
      date: '2026-10-20',
    });
    assert.equal(parseArgs(['--from=def']).from, 'def');
    assert.equal(parseArgs(['--from=']).from, null);
    assert.equal(parseArgs(['--from']).from, null);
  });

  test('argumento desconhecido lança', () => {
    assert.throws(() => parseArgs(['--push']), /Argumento desconhecido/);
  });
});

describe('parseLog', () => {
  test('separa registros, corpo e arquivos', () => {
    const output =
      '\x1eaaa\x1ffeat(adm): x\x1fcorpo\x1f\n\napps/adm.fonte/a.tsx\nb.ts\n' +
      '\x1ebbb\x1ffix: y\x1f\x1f\n';
    assert.deepEqual(parseLog(output), [
      { hash: 'aaa', subject: 'feat(adm): x', body: 'corpo', files: ['apps/adm.fonte/a.tsx', 'b.ts'] },
      { hash: 'bbb', subject: 'fix: y', body: '', files: [] },
    ]);
  });

  test('registro sem campo de arquivos', () => {
    assert.deepEqual(parseLog('\x1eccc\x1fdocs: z\x1fb'), [
      { hash: 'ccc', subject: 'docs: z', body: 'b', files: [] },
    ]);
  });
});

describe('git + collect em repositório real', () => {
  let repo;
  let firstHash;

  before(() => {
    repo = createRepo({ opsVersion: '1.0.0' });
    firstHash = repo.commit('chore: init');
    repo.commit('feat(story-10): tela nova no ops', { files: ['apps/ops.fonte/a.tsx'] });
  });

  after(() => repo.cleanup());

  test('sem tag: lastTag null e collect pede ponto de partida', () => {
    assert.equal(lastTag(repo.dir), null);
    const report = collect({ cwd: repo.dir });
    assert.equal(report.firstRelease, true);
    assert.equal(report.needsStartingPoint, true);
    assert.equal(report.suggestedVersion, '1.0.0');
    assert.equal(report.range, null);
    assert.deepEqual(report.sections, []);
  });

  test('sem tag, com --from: lista a partir do ponto combinado, sem bump', () => {
    const report = collect({ cwd: repo.dir, from: firstHash });
    assert.equal(report.firstRelease, true);
    assert.equal(report.needsStartingPoint, false);
    assert.equal(report.bump, null);
    assert.equal(report.suggestedVersion, '1.0.0');
    assert.equal(report.sections[0].section, 'Ops (celular)');
    assert.equal(report.sections[0].commits[0].story, 10);
  });

  test('readCommits sem ponto de partida devolve o histórico inteiro', () => {
    assert.equal(readCommits(null, repo.dir).length, 2);
  });

  test('com tag: commits desde a tag e bump sugerido', () => {
    repo.tag('v1.0.0');
    repo.commit('fix(story-11): corrige o adm', { files: ['apps/adm.fonte/b.tsx'] });
    repo.commit('test(story-11): cobre o adm', { files: ['apps/adm.fonte/b.test.tsx'] });

    assert.equal(lastTag(repo.dir), 'v1.0.0');
    const report = collect({ cwd: repo.dir });
    assert.equal(report.range, 'v1.0.0..HEAD');
    assert.equal(report.bump, 'patch');
    assert.equal(report.suggestedVersion, '1.0.1');
    assert.equal(report.excludedCount, 1);
    assert.deepEqual(report.sections.map((group) => group.section), ['Administração']);
  });

  test('main imprime JSON por padrão e rascunho com --markdown', () => {
    let out = '';
    const write = (text) => {
      out += text;
    };
    const report = main([], { cwd: repo.dir, write });
    assert.equal(JSON.parse(out).suggestedVersion, report.suggestedVersion);

    out = '';
    main(['--markdown'], { cwd: repo.dir, write, today: new Date('2026-10-20T10:00:00Z') });
    assert.match(out, /^---\nversion: 1\.0\.1\ndate: 2026-10-20\n/);

    out = '';
    main(['--markdown', '--date=2026-11-01'], { cwd: repo.dir, write });
    assert.match(out, /date: 2026-11-01/);
  });

  test('a CLI roda de verdade e só lê o repositório', () => {
    const before = execFileSync('git', ['status', '--porcelain'], { cwd: repo.dir, encoding: 'utf8' });
    const out = execFileSync(process.execPath, [COLLECT], { cwd: repo.dir, encoding: 'utf8' });
    assert.equal(JSON.parse(out).lastTag, 'v1.0.0');
    const afterStatus = execFileSync('git', ['status', '--porcelain'], { cwd: repo.dir, encoding: 'utf8' });
    assert.equal(afterStatus, before);
  });

  test('a CLI sai com código 1 em argumento inválido', () => {
    assert.throws(
      () => execFileSync(process.execPath, [COLLECT, '--push'], { cwd: repo.dir, stdio: 'pipe' }),
      (error) => error.status === 1 && /Argumento desconhecido/.test(String(error.stderr)),
    );
  });
});
