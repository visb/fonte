// Núcleo PURO do script de release (story 213): classifica commits
// convencionais, sugere o bump semver e agrupa por app. Sem I/O — o acesso ao
// git mora em git.mjs e a orquestração em collect.mjs.
//
// A redação final do changelog é do modelo (skill fonte-release) com aprovação
// do usuário; este módulo só entrega a matéria-prima organizada.

export const SECTIONS = {
  ops: 'Ops (celular)',
  adm: 'Administração',
  portal: 'Portal',
  app: 'App das famílias',
  general: 'Geral',
};

/** Ordem das seções no rascunho (mesma do changelog publicado). */
export const SECTION_ORDER = [
  SECTIONS.ops,
  SECTIONS.adm,
  SECTIONS.portal,
  SECTIONS.app,
  SECTIONS.general,
];

const SCOPE_TO_SECTION = {
  ops: SECTIONS.ops,
  'apps/ops': SECTIONS.ops,
  'ops.fonte': SECTIONS.ops,
  adm: SECTIONS.adm,
  'apps/adm': SECTIONS.adm,
  'adm.fonte': SECTIONS.adm,
  portal: SECTIONS.portal,
  'apps/portal': SECTIONS.portal,
  'portal.fonte': SECTIONS.portal,
  app: SECTIONS.app,
  'apps/app': SECTIONS.app,
  'app.fonte': SECTIONS.app,
  api: SECTIONS.general,
  'services/api': SECTIONS.general,
};

const PATH_TO_SECTION = [
  ['apps/ops.fonte/', SECTIONS.ops],
  ['apps/adm.fonte/', SECTIONS.adm],
  ['apps/portal.fonte/', SECTIONS.portal],
  ['apps/app.fonte/', SECTIONS.app],
];

/** Tipos puramente técnicos: não interessam a quem usa a plataforma. */
const TECHNICAL_TYPES = new Set(['test', 'chore', 'ci', 'refactor', 'style', 'build']);

/** Tipos permitidos pelo CONTRIBUTING.md; qualquer outro é "fora da convenção". */
const KNOWN_TYPES = new Set([...TECHNICAL_TYPES, 'feat', 'fix', 'docs', 'perf', 'revert']);

const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;
const STORY_SCOPE = /^story-(\d+)$/;

/**
 * Parse do cabeçalho convencional. `null` = commit fora da convenção.
 * Tolera o "@ " que vazou no título de alguns commits antigos (here-string do
 * PowerShell na tool Bash — ver CLAUDE.md).
 */
export function parseCommit({ hash = '', subject = '', body = '', files = [] }) {
  const cleaned = subject.replace(/^@\s+/, '').trim();
  const match = HEADER.exec(cleaned);
  if (!match || !KNOWN_TYPES.has(match[1].toLowerCase())) return null;
  const [, type, scope = '', bang, description] = match;
  const story = STORY_SCOPE.exec(scope);
  return {
    hash,
    type: type.toLowerCase(),
    scope,
    description: description.trim(),
    breaking: Boolean(bang) || BREAKING_FOOTER.test(body),
    story: story ? Number(story[1]) : null,
    files,
  };
}

/** Commit técnico fica fora do changelog — exceto quebra, que sempre aparece. */
export function isExcluded(commit) {
  if (commit.breaking) return false;
  if (TECHNICAL_TYPES.has(commit.type)) return true;
  if (commit.type === 'docs' && (commit.scope === 'stories' || commit.story !== null)) return true;
  return false;
}

/**
 * Seções (apps) do commit. Scope conhecido manda; scope `story-NN` ou
 * desconhecido cai nos caminhos tocados; sem pista nenhuma → "Geral".
 */
export function sectionsFor(commit) {
  const byScope = SCOPE_TO_SECTION[commit.scope];
  if (byScope) return [byScope];

  const fromPaths = new Set();
  for (const file of commit.files ?? []) {
    const normalized = file.replace(/\\/g, '/');
    const hit = PATH_TO_SECTION.find(([prefix]) => normalized.startsWith(prefix));
    if (hit) fromPaths.add(hit[1]);
  }
  if (fromPaths.size === 0) return [SECTIONS.general];
  return SECTION_ORDER.filter((section) => fromPaths.has(section));
}

/** major se há quebra; minor se há feat; patch se há qualquer outra entrada; null se vazio. */
export function suggestBump(commits) {
  if (commits.length === 0) return null;
  if (commits.some((commit) => commit.breaking)) return 'major';
  if (commits.some((commit) => commit.type === 'feat')) return 'minor';
  return 'patch';
}

export function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`Versão inválida: "${version}"`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Bump inválido: "${bump}"`);
}

/** Agrupa os commits incluídos por seção, na ordem do changelog. */
export function groupBySection(commits) {
  const groups = new Map(SECTION_ORDER.map((section) => [section, []]));
  for (const commit of commits) {
    for (const section of sectionsFor(commit)) groups.get(section).push(commit);
  }
  return SECTION_ORDER.filter((section) => groups.get(section).length > 0).map((section) => ({
    section,
    commits: groups.get(section),
  }));
}

/**
 * Classifica a lista crua (do git) em incluídos / excluídos / fora da convenção
 * e calcula a versão sugerida.
 *
 * - Com tag anterior: a sugestão é o bump sobre a versão da tag.
 * - Primeira release (sem tag): a sugestão é a versão ATUAL do package.json do
 *   ops — o ponto de partida do histórico é combinado com o usuário (--from).
 */
export function analyze({ rawCommits, lastTag, currentVersion }) {
  const included = [];
  const excluded = [];
  const unconventional = [];
  for (const raw of rawCommits) {
    const commit = parseCommit(raw);
    if (!commit) unconventional.push({ hash: raw.hash, subject: raw.subject });
    else if (isExcluded(commit)) excluded.push(commit);
    else included.push(commit);
  }

  const bump = suggestBump(included);
  const firstRelease = !lastTag;
  let suggestedVersion = currentVersion;
  if (!firstRelease && bump) suggestedVersion = bumpVersion(lastTag.replace(/^v/, ''), bump);

  return {
    lastTag: lastTag ?? null,
    firstRelease,
    currentVersion,
    bump: firstRelease ? null : bump,
    suggestedVersion,
    sections: groupBySection(included),
    stories: [...new Set(included.map((commit) => commit.story).filter((n) => n !== null))].sort(
      (a, b) => a - b,
    ),
    excludedCount: excluded.length,
    unconventional,
  };
}

/** Rascunho em markdown (frontmatter + seções com os títulos dos commits). */
export function formatDraft(report, { date, summary = 'TODO: resumo da versão em uma linha.' }) {
  const lines = [
    '---',
    `version: ${report.suggestedVersion}`,
    `date: ${date}`,
    `summary: ${summary}`,
    'apk: true',
    `breaking: ${report.bump === 'major'}`,
    '---',
  ];
  for (const { section, commits } of report.sections) {
    lines.push(`## ${section}`, '');
    for (const commit of commits) {
      const ref = commit.story !== null ? ` (story ${commit.story})` : '';
      lines.push(`- ${commit.description}${ref}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
