import type { Release } from '@/lib/releases';

export function ReleaseBadges({ release }: { release: Release }) {
  if (!release.apk && !release.breaking) return null;
  return (
    <span className="badges">
      {release.apk && <span className="badge">APK novo</span>}
      {release.breaking && <span className="badge warning">Exige reinstalar</span>}
    </span>
  );
}
