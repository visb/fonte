import { formatBytes, formatDate } from '@/lib/format';
import { APK_URL, versionedApkUrl, type LatestApk } from '../lib/latestApk';

export function DownloadCard({ apk }: { apk: LatestApk }) {
  return (
    <section className="card" aria-labelledby="download-title">
      <h2 id="download-title">App OPS Fonte para Android</h2>
      <p className="muted">
        Versão <strong data-testid="apk-version">{apk.version}</strong> ·{' '}
        <span data-testid="apk-size">{formatBytes(apk.sizeBytes)}</span> · publicada em{' '}
        {formatDate(apk.builtAt.slice(0, 10))}
      </p>
      <a className="button primary" href={APK_URL} download data-testid="download-apk">
        Baixar APK do Ops
      </a>
      <p className="hint">
        Link fixo desta versão:{' '}
        <a href={versionedApkUrl(apk.version)} download data-testid="download-apk-versioned">
          ops-{apk.version}.apk
        </a>
      </p>
      <details className="checksum">
        <summary>Conferir o arquivo (SHA-256)</summary>
        <code data-testid="apk-sha256">{apk.sha256}</code>
      </details>
    </section>
  );
}
