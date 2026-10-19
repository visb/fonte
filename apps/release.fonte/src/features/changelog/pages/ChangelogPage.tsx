import { Layout } from '@/components/Layout';
import { ReleaseList } from '../components/ReleaseList';
import { useReleases } from '../hooks/useReleases';

export function ChangelogPage() {
  const releases = useReleases();
  return (
    <Layout>
      <h1 className="page-title">Changelog</h1>
      <p className="muted">O que mudou na plataforma a cada versão, da mais nova para a mais antiga.</p>
      <ReleaseList releases={releases} />
    </Layout>
  );
}
