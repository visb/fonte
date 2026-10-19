import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/format';
import type { Release } from '@/lib/releases';
import { ReleaseBadges } from './ReleaseBadges';

export function ReleaseListItem({ release }: { release: Release }) {
  return (
    <li>
      <Link
        to={`/changelog/${release.version}`}
        className="release-link"
        data-testid="release-item"
      >
        <span className="release-heading">
          <span className="release-version">v{release.version}</span>
          <span className="release-date">{formatDate(release.date)}</span>
        </span>
        <span className="release-summary">{release.summary}</span>
        <ReleaseBadges release={release} />
      </Link>
    </li>
  );
}
