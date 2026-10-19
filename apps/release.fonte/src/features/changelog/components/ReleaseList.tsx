import { EmptyState } from '@/components/StateScreens';
import type { Release } from '@/lib/releases';
import { ReleaseListItem } from './ReleaseListItem';

export function ReleaseList({ releases }: { releases: Release[] }) {
  if (!releases.length) {
    return <EmptyState title="Nenhuma versão publicada ainda" />;
  }
  return (
    <ul className="release-list">
      {releases.map((release) => (
        <ReleaseListItem key={release.version} release={release} />
      ))}
    </ul>
  );
}
