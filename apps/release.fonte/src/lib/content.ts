import { loadReleases } from './releases';

// Todo o conteúdo do changelog vem do repositório em build-time: cada arquivo
// de content/releases entra no bundle como string e passa pelo parser.
const files = import.meta.glob('../../content/releases/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const releases = loadReleases(files);
