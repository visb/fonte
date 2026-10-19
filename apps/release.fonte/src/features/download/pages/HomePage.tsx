import { Layout } from '@/components/Layout';
import { EmptyState } from '@/components/StateScreens';
import { useReleases } from '@/features/changelog/hooks/useReleases';
import { ApkSection } from '../components/ApkSection';
import { CurrentReleaseCard } from '../components/CurrentReleaseCard';
import { InstallSteps } from '../components/InstallSteps';
import { useLatestApk } from '../hooks/useLatestApk';

export function HomePage() {
  const releases = useReleases();
  const { data: apk, isLoading, error, refetch } = useLatestApk();

  // A release "atual" é a do APK publicado; sem APK, a mais nova do changelog.
  const current = releases.find((release) => release.version === apk?.version) ?? releases[0];

  return (
    <Layout>
      {current ? (
        <CurrentReleaseCard release={current} />
      ) : (
        <EmptyState title="Nenhuma versão publicada ainda" />
      )}
      <ApkSection
        apk={apk}
        isLoading={isLoading}
        error={error}
        breaking={Boolean(current?.breaking && current.version === apk?.version)}
        onRetry={() => void refetch()}
      />
      <InstallSteps />
    </Layout>
  );
}
