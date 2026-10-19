import { EmptyState, ErrorState, LoadingState } from '@/components/StateScreens';
import type { LatestApk } from '../lib/latestApk';
import { BreakingNotice } from './BreakingNotice';
import { DownloadCard } from './DownloadCard';

interface ApkSectionProps {
  apk: LatestApk | null | undefined;
  isLoading: boolean;
  error: Error | null;
  breaking: boolean;
  onRetry: () => void;
}

export function ApkSection({ apk, isLoading, error, breaking, onRetry }: ApkSectionProps) {
  if (isLoading) return <LoadingState message="Verificando o APK publicado..." />;
  if (error) return <ErrorState message="Não foi possível verificar o APK." onRetry={onRetry} />;
  if (!apk) {
    return (
      <EmptyState
        title="APK ainda não publicado"
        message="A primeira versão do app para Android ainda está sendo preparada. Volte em breve."
      />
    );
  }
  return (
    <>
      {breaking && <BreakingNotice />}
      <DownloadCard apk={apk} />
    </>
  );
}
