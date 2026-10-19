import { formatDate } from '@/lib/format';
import type { Release } from '@/lib/releases';
import { MarkdownBody } from './MarkdownBody';
import { ReleaseBadges } from './ReleaseBadges';

export function ReleaseDetail({ release }: { release: Release }) {
  return (
    <article className="card">
      <header className="release-detail-header">
        <h1>v{release.version}</h1>
        <p className="muted">{formatDate(release.date)}</p>
        <ReleaseBadges release={release} />
        <p className="release-summary">{release.summary}</p>
      </header>
      <MarkdownBody source={release.body} />
    </article>
  );
}
