import { compareSemver, loadReleases, parseRelease, parseSemver, sortReleases } from './releases';

function file(frontmatter: string, body = '## Ops (celular)\n- item') {
  return `---\n${frontmatter}\n---\n${body}`;
}

const VALID = 'version: 1.1.0\ndate: 2026-10-20\nsummary: Destaque da versão.';

describe('parseRelease', () => {
  it('faz o parse de frontmatter válido e separa o corpo', () => {
    const release = parseRelease(file(`${VALID}\napk: true\nbreaking: true`));
    expect(release).toEqual({
      version: '1.1.0',
      date: '2026-10-20',
      summary: 'Destaque da versão.',
      apk: true,
      breaking: true,
      body: '## Ops (celular)\n- item',
    });
  });

  it('assume apk e breaking false quando ausentes', () => {
    const release = parseRelease(file(VALID));
    expect(release.apk).toBe(false);
    expect(release.breaking).toBe(false);
  });

  it('aceita false explícito, aspas, comentários e CRLF', () => {
    const raw = file(
      `version: "1.2.0"\ndate: '2026-11-01'\n# comentário\nsummary: Algo # nota\napk: false  # sem APK`,
    ).replace(/\n/g, '\r\n');
    const release = parseRelease(raw);
    expect(release.version).toBe('1.2.0');
    expect(release.date).toBe('2026-11-01');
    expect(release.summary).toBe('Algo');
    expect(release.apk).toBe(false);
  });

  it('lança quando falta version', () => {
    expect(() => parseRelease(file('date: 2026-10-20\nsummary: x'), 'v1.md')).toThrow(
      /v1\.md: campo obrigatório "version"/,
    );
  });

  it('lança quando falta date', () => {
    expect(() => parseRelease(file('version: 1.0.0\nsummary: x'))).toThrow(/"date"/);
  });

  it('lança quando falta summary', () => {
    expect(() => parseRelease(file('version: 1.0.0\ndate: 2026-10-20'))).toThrow(/"summary"/);
  });

  it('lança sem bloco de frontmatter', () => {
    expect(() => parseRelease('## só corpo')).toThrow(/frontmatter ausente/);
  });

  it('lança com linha de frontmatter malformada', () => {
    expect(() => parseRelease(file(`${VALID}\nisso não é chave`))).toThrow(/linha de frontmatter/);
  });

  it('lança com versão fora do semver', () => {
    expect(() => parseRelease(file('version: 1.0\ndate: 2026-10-20\nsummary: x'))).toThrow(
      /Versão inválida/,
    );
  });

  it('lança com data fora do formato ISO', () => {
    expect(() => parseRelease(file('version: 1.0.0\ndate: 20/10/2026\nsummary: x'))).toThrow(
      /AAAA-MM-DD/,
    );
  });

  it('lança com booleano inválido', () => {
    expect(() => parseRelease(file(`${VALID}\nbreaking: sim`))).toThrow(/"breaking" deve ser/);
  });
});

describe('semver', () => {
  it('ordena numericamente, não lexicograficamente (1.10.0 > 1.9.0)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
  });

  it('trata pré-release como anterior à versão final', () => {
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.2')).toBeLessThan(0);
    expect(compareSemver('1.0.0-rc.2', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('parseSemver expõe as partes e lança em versão inválida', () => {
    expect(parseSemver('0.0.0-rc.1')).toEqual({ major: 0, minor: 0, patch: 0, prerelease: 'rc.1' });
    expect(() => parseSemver('v1.0.0')).toThrow();
  });

  it('sortReleases devolve do mais novo para o mais antigo sem mutar a entrada', () => {
    const input = ['1.9.0', '1.10.0', '1.2.0'].map((version) =>
      parseRelease(file(`version: ${version}\ndate: 2026-10-20\nsummary: x`)),
    );
    const sorted = sortReleases(input);
    expect(sorted.map((release) => release.version)).toEqual(['1.10.0', '1.9.0', '1.2.0']);
    expect(input[0].version).toBe('1.9.0');
  });
});

describe('loadReleases', () => {
  it('carrega e ordena o mapa do import.meta.glob', () => {
    const releases = loadReleases({
      '../../content/releases/v1.9.0.md': file('version: 1.9.0\ndate: 2026-10-01\nsummary: a'),
      '../../content/releases/v1.10.0.md': file('version: 1.10.0\ndate: 2026-10-02\nsummary: b'),
    });
    expect(releases.map((release) => release.version)).toEqual(['1.10.0', '1.9.0']);
  });

  it('aceita caminho com barra invertida (Windows)', () => {
    const releases = loadReleases({
      'content\\releases\\v1.0.0.md': file('version: 1.0.0\ndate: 2026-10-01\nsummary: a'),
    });
    expect(releases).toHaveLength(1);
  });

  it('lança quando o nome do arquivo não bate com a versão', () => {
    expect(() =>
      loadReleases({ 'releases/v1.0.0.md': file('version: 1.0.1\ndate: 2026-10-01\nsummary: a') }),
    ).toThrow(/deve ser v1\.0\.1\.md/);
  });

  it('lança com versão repetida', () => {
    const raw = file('version: 1.0.0\ndate: 2026-10-01\nsummary: a');
    expect(() => loadReleases({ 'a/v1.0.0.md': raw, 'b/v1.0.0.md': raw })).toThrow(/repetida/);
  });

  it('lista vazia não é erro', () => {
    expect(loadReleases({})).toEqual([]);
  });
});
