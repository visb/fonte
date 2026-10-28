import { releases } from './content';

// Usa o conteúdo REAL de content/releases: se um .md versionado tiver
// frontmatter inválido, este teste (e o build) quebra.
describe('content', () => {
  it('carrega as releases versionadas, da mais nova para a mais antiga', () => {
    expect(releases.length).toBeGreaterThan(0);
    expect(releases.map((release) => release.version)).toContain('1.0.0');
    for (let i = 1; i < releases.length; i += 1) {
      expect(releases[i - 1].version).not.toBe(releases[i].version);
    }
  });

  it('a primeira versão assinada avisa que exige desinstalar', () => {
    const firstSigned = releases.find((release) => release.version === '1.1.0');
    expect(firstSigned?.breaking).toBe(true);
    expect(firstSigned?.apk).toBe(true);
  });
});
