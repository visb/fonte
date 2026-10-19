import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECTIONS,
  analyze,
  bumpVersion,
  formatDraft,
  groupBySection,
  isExcluded,
  parseCommit,
  sectionsFor,
  suggestBump,
} from './lib.mjs';

const c = (subject, extra = {}) => parseCommit({ hash: 'h', subject, ...extra });

describe('parseCommit', () => {
  test('lê type, scope, descrição e story', () => {
    const commit = c('feat(story-199): auditoria de ações');
    assert.equal(commit.type, 'feat');
    assert.equal(commit.scope, 'story-199');
    assert.equal(commit.description, 'auditoria de ações');
    assert.equal(commit.story, 199);
    assert.equal(commit.breaking, false);
  });

  test('sem scope e com "@ " vazado no título', () => {
    const commit = c('@ fix: corrigir algo');
    assert.equal(commit.type, 'fix');
    assert.equal(commit.scope, '');
    assert.equal(commit.story, null);
  });

  test('quebra por "!" e por rodapé BREAKING CHANGE', () => {
    assert.equal(c('feat(ops)!: nova assinatura').breaking, true);
    assert.equal(c('feat(ops): x', { body: 'detalhe\n\nBREAKING CHANGE: reinstalar' }).breaking, true);
    assert.equal(c('feat(ops): x', { body: 'BREAKING-CHANGE: y' }).breaking, true);
  });

  test('commit fora da convenção devolve null', () => {
    // Tipo fora da lista do CONTRIBUTING.md também é "fora da convenção".
    assert.equal(c('merge: story 199'), null);
    assert.equal(c('update stuff'), null);
    assert.equal(parseCommit({}), null);
  });
});

describe('isExcluded', () => {
  test('exclui test, chore, ci, refactor e docs(stories)', () => {
    for (const subject of [
      'test(story-182): suites idempotentes',
      'chore(ops): titulo',
      'ci: subir node',
      'refactor(story-190): remover redis',
      'docs(stories): plano da story 213',
      'docs(story-172): Postman',
      'style: formatar',
      'build: deps',
    ]) {
      assert.equal(isExcluded(c(subject)), true, subject);
    }
  });

  test('mantém feat, fix, perf e docs fora de stories', () => {
    for (const subject of ['feat(adm): x', 'fix(apps/ops): y', 'perf(api): z', 'docs(comunicacao): w']) {
      assert.equal(isExcluded(c(subject)), false, subject);
    }
  });

  test('quebra nunca é excluída, mesmo em tipo técnico', () => {
    assert.equal(isExcluded(c('refactor(api)!: troca de contrato')), false);
  });
});

describe('sectionsFor', () => {
  test('scope conhecido mapeia para o app', () => {
    assert.deepEqual(sectionsFor(c('fix(apps/ops): x')), [SECTIONS.ops]);
    assert.deepEqual(sectionsFor(c('feat(adm): x')), [SECTIONS.adm]);
    assert.deepEqual(sectionsFor(c('feat(portal.fonte): x')), [SECTIONS.portal]);
    assert.deepEqual(sectionsFor(c('feat(app): x')), [SECTIONS.app]);
    assert.deepEqual(sectionsFor(c('feat(services/api): x')), [SECTIONS.general]);
  });

  test('scope story-NN usa os caminhos tocados (na ordem do changelog)', () => {
    const commit = c('feat(story-200): x', {
      files: ['apps/adm.fonte/src/a.tsx', 'apps\\ops.fonte\\b.tsx', 'services/api/c.ts'],
    });
    assert.deepEqual(sectionsFor(commit), [SECTIONS.ops, SECTIONS.adm]);
  });

  test('scope desconhecido sem caminho de app vai para "Geral"', () => {
    assert.deepEqual(sectionsFor(c('feat(backup): x')), [SECTIONS.general]);
    assert.deepEqual(sectionsFor(c('feat(story-1): x', { files: ['services/api/x.ts'] })), [
      SECTIONS.general,
    ]);
    assert.deepEqual(sectionsFor({ scope: 'x' }), [SECTIONS.general]);
  });
});

describe('suggestBump / bumpVersion', () => {
  test('só fix → patch', () => {
    assert.equal(suggestBump([c('fix(ops): a'), c('perf(api): b')]), 'patch');
  });

  test('algum feat → minor', () => {
    assert.equal(suggestBump([c('fix(ops): a'), c('feat(adm): b')]), 'minor');
  });

  test('"!" ou BREAKING CHANGE → major', () => {
    assert.equal(suggestBump([c('feat(adm): b'), c('fix(ops)!: a')]), 'major');
    assert.equal(suggestBump([c('fix(ops): a', { body: 'BREAKING CHANGE: x' })]), 'major');
  });

  test('nada a publicar → null', () => {
    assert.equal(suggestBump([]), null);
  });

  test('bumpVersion', () => {
    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
    assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
    assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
    assert.throws(() => bumpVersion('x', 'patch'), /Versão inválida/);
    assert.throws(() => bumpVersion('1.0.0', 'mega'), /Bump inválido/);
  });
});

describe('groupBySection', () => {
  test('agrupa na ordem do changelog e omite seções vazias', () => {
    const groups = groupBySection([c('feat(adm): a'), c('fix(ops): b'), c('feat(x): c')]);
    assert.deepEqual(
      groups.map((group) => group.section),
      [SECTIONS.ops, SECTIONS.adm, SECTIONS.general],
    );
  });
});

describe('analyze', () => {
  const raw = (subject, extra = {}) => ({ hash: subject, subject, body: '', files: [], ...extra });

  test('com tag anterior: sugere bump sobre a tag e separa excluídos/fora da convenção', () => {
    const report = analyze({
      rawCommits: [
        raw('feat(story-12): nova tela', { files: ['apps/ops.fonte/x.tsx'] }),
        raw('fix(story-3): corrige', { files: ['apps/adm.fonte/y.tsx'] }),
        raw('test(story-12): cobre'),
        raw('docs(stories): plano'),
        raw('atualiza coisas'),
      ],
      lastTag: 'v1.2.0',
      currentVersion: '1.2.0',
    });
    assert.equal(report.firstRelease, false);
    assert.equal(report.bump, 'minor');
    assert.equal(report.suggestedVersion, '1.3.0');
    assert.equal(report.excludedCount, 2);
    assert.deepEqual(report.unconventional, [{ hash: 'atualiza coisas', subject: 'atualiza coisas' }]);
    assert.deepEqual(report.stories, [3, 12]);
    assert.deepEqual(
      report.sections.map((group) => group.section),
      [SECTIONS.ops, SECTIONS.adm],
    );
  });

  test('com tag e só commits técnicos: mantém a versão atual e bump null', () => {
    const report = analyze({
      rawCommits: [raw('chore: x')],
      lastTag: 'v1.2.0',
      currentVersion: '1.2.0',
    });
    assert.equal(report.bump, null);
    assert.equal(report.suggestedVersion, '1.2.0');
  });

  test('primeira release (sem tag): sugere a versão atual, sem bump', () => {
    const report = analyze({
      rawCommits: [raw('feat(adm): a')],
      lastTag: undefined,
      currentVersion: '1.0.0',
    });
    assert.equal(report.firstRelease, true);
    assert.equal(report.lastTag, null);
    assert.equal(report.bump, null);
    assert.equal(report.suggestedVersion, '1.0.0');
  });
});

describe('formatDraft', () => {
  test('gera frontmatter válido e seções com referência à story', () => {
    const report = analyze({
      rawCommits: [
        { hash: 'a', subject: 'feat(story-7)!: nova versão', body: '', files: ['apps/ops.fonte/a'] },
        { hash: 'b', subject: 'fix(adm): ajuste', body: '', files: [] },
      ],
      lastTag: 'v1.0.0',
      currentVersion: '1.0.0',
    });
    const draft = formatDraft(report, { date: '2026-10-20' });
    assert.match(draft, /^---\nversion: 2\.0\.0\ndate: 2026-10-20\nsummary: TODO/);
    assert.match(draft, /breaking: true/);
    assert.match(draft, /## Ops \(celular\)\n\n- nova versão \(story 7\)/);
    assert.match(draft, /## Administração\n\n- ajuste\n$/);
  });

  test('aceita resumo informado', () => {
    const report = analyze({ rawCommits: [], lastTag: 'v1.0.0', currentVersion: '1.0.0' });
    const draft = formatDraft(report, { date: '2026-10-20', summary: 'Resumo.' });
    assert.match(draft, /summary: Resumo\.\napk: true\nbreaking: false\n---\n$/);
  });
});
