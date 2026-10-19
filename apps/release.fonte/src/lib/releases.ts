// Parser do conteúdo do changelog (content/releases/vX.Y.Z.md).
//
// Módulo PURO e sem dependência de browser: roda no app (via import.meta.glob)
// e no plugin de validação do vite.config.ts, que o executa no início do build.
// Qualquer frontmatter inválido LANÇA — a release quebrada derruba o build em
// vez de desaparecer em silêncio da página publicada.

export interface Release {
  version: string;
  date: string;
  summary: string;
  apk: boolean;
  breaking: boolean;
  body: string;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

export function parseSemver(version: string): ParsedSemver {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Versão inválida: "${version}" (esperado X.Y.Z)`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/** Comparação semver: negativo se a < b, positivo se a > b, 0 se iguais. */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  const numeric =
    left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (numeric !== 0) return numeric;
  if (left.prerelease === right.prerelease) return 0;
  // Versão final é maior que qualquer pré-release da mesma X.Y.Z.
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease < right.prerelease ? -1 : 1;
}

function stripQuotes(value: string): string {
  const quoted = /^(['"])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

function parseFields(block: string, source: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`${source}: linha de frontmatter inválida: "${line}"`);
    // Comentário de fim de linha (`apk: true  # publica APK`) não faz parte do valor.
    fields[match[1]] = stripQuotes(match[2].replace(/\s+#.*$/, '').trim());
  }
  return fields;
}

function parseBoolean(value: string | undefined, field: string, source: string): boolean {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${source}: "${field}" deve ser true ou false (recebido "${value}")`);
}

function requireField(fields: Record<string, string>, field: string, source: string): string {
  const value = fields[field];
  if (!value) throw new Error(`${source}: campo obrigatório "${field}" ausente no frontmatter`);
  return value;
}

/** Faz o parse de UM arquivo de release. `source` só entra nas mensagens de erro. */
export function parseRelease(raw: string, source = 'release'): Release {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = FRONTMATTER.exec(normalized);
  if (!match) throw new Error(`${source}: frontmatter ausente (o arquivo deve começar com ---)`);

  const fields = parseFields(match[1], source);
  const version = requireField(fields, 'version', source);
  const date = requireField(fields, 'date', source);
  const summary = requireField(fields, 'summary', source);

  parseSemver(version);
  if (!ISO_DATE.test(date)) {
    throw new Error(`${source}: "date" deve estar no formato AAAA-MM-DD (recebido "${date}")`);
  }

  return {
    version,
    date,
    summary,
    apk: parseBoolean(fields.apk, 'apk', source),
    breaking: parseBoolean(fields.breaking, 'breaking', source),
    body: match[2].trim(),
  };
}

/** Ordena por semver DECRESCENTE (a mais nova primeiro). Não muta a entrada. */
export function sortReleases(releases: Release[]): Release[] {
  return [...releases].sort((a, b) => compareSemver(b.version, a.version));
}

function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

/**
 * Carrega o mapa caminho → conteúdo (formato do import.meta.glob). O nome do
 * arquivo tem de casar com a versão do frontmatter: é por ele que o release.yml
 * confere que a tag tem changelog.
 */
export function loadReleases(files: Record<string, string>): Release[] {
  const seen = new Set<string>();
  const releases = Object.entries(files).map(([filePath, raw]) => {
    const file = basename(filePath);
    const release = parseRelease(raw, file);
    if (file !== `v${release.version}.md`) {
      throw new Error(`${file}: o nome do arquivo deve ser v${release.version}.md`);
    }
    if (seen.has(release.version)) throw new Error(`${file}: versão ${release.version} repetida`);
    seen.add(release.version);
    return release;
  });
  return sortReleases(releases);
}
