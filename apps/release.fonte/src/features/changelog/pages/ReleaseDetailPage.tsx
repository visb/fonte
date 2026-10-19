import { Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { EmptyState } from '@/components/StateScreens';
import { ReleaseDetail } from '../components/ReleaseDetail';
import { useReleaseByVersion } from '../hooks/useReleases';

export function ReleaseDetailPage() {
  const { version } = useParams<{ version: string }>();
  const release = useReleaseByVersion(version);

  return (
    <Layout>
      <Link to="/changelog" className="back-link">
        ← Voltar para o changelog
      </Link>
      {release ? (
        <ReleaseDetail release={release} />
      ) : (
        <EmptyState
          title="Versão não encontrada"
          message={`Não há registro da versão ${version} no changelog.`}
        />
      )}
    </Layout>
  );
}
