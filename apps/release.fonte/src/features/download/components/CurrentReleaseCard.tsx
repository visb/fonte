import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/format';
import type { Release } from '@/lib/releases';

export function CurrentReleaseCard({ release }: { release: Release }) {
  return (
    <section className="card hero" aria-labelledby="current-title">
      <p className="eyebrow">Versão atual da plataforma</p>
      <h1 id="current-title">v{release.version}</h1>
      <p className="muted">{formatDate(release.date)}</p>
      <p>{release.summary}</p>
      <Link to={`/changelog/${release.version}`}>Ver o que mudou nesta versão</Link>
      {' · '}
      <Link to="/changelog">Todas as versões</Link>
    </section>
  );
}
