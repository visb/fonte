import { useState } from 'react';
import { Download, Loader2, ShieldAlert, ShieldCheck, History } from 'lucide-react';
import type { ConsentPurpose } from '@fonte/api-client';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import {
  useResidentConsents, useGrantConsent, useRevokeConsent,
  useResidentAudit, useAnonymizeResident,
} from '../../hooks/usePrivacy';

const PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  IMAGE_PUBLICATION: 'Uso de imagem / divulgação',
  RELIGIOUS_DISCLOSURE: 'Divulgação religiosa / testemunho',
};

function ConsentRow({ residentId, purpose, granted, since }: {
  residentId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  since: string | null;
}) {
  const grant = useGrantConsent(residentId);
  const revoke = useRevokeConsent(residentId);
  const pending = grant.isPending || revoke.isPending;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{PURPOSE_LABELS[purpose]}</p>
        {granted && since && (
          <p className="text-xs text-muted-foreground">Desde {new Date(since).toLocaleDateString('pt-BR')}</p>
        )}
      </div>
      <Badge variant="outline" className={granted ? 'text-green-600 border-green-200' : 'text-muted-foreground'}>
        {granted ? 'Consentido' : 'Sem consentimento'}
      </Badge>
      <Button
        variant={granted ? 'ghost' : 'outline'}
        size="sm"
        disabled={pending}
        onClick={() => (granted ? revoke.mutate(purpose) : grant.mutate(purpose))}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : granted ? 'Revogar' : 'Registrar'}
      </Button>
    </div>
  );
}

function AuditList({ residentId }: { residentId: string }) {
  const [open, setOpen] = useState(false);
  const { data: logs = [], isLoading } = useResidentAudit(residentId, open);

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <History size={14} className="mr-1.5" />
        {open ? 'Ocultar trilha de auditoria' : 'Ver trilha de auditoria'}
      </Button>
      {open && (isLoading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nenhum registro de acesso.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded border bg-card px-3 py-2 text-xs">
              <span className="font-mono text-muted-foreground">{log.action}</span>
              <span className="text-muted-foreground">{log.role ?? '—'}</span>
              <span className="ml-auto text-muted-foreground">
                {new Date(log.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Props {
  residentId: string;
  residentName: string;
}

export function PrivacyTab({ residentId, residentName }: Props) {
  const { data: consents = [], isLoading } = useResidentConsents(residentId);
  const anonymize = useAnonymizeResident(residentId);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await api.residents.exportData(residentId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados-${residentName.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e, 'Falha ao exportar dados'));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consentimentos</h3>
        {(['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'] as ConsentPurpose[]).map((purpose) => {
          const status = consents.find((c) => c.purpose === purpose);
          return (
            <ConsentRow
              key={purpose}
              residentId={residentId}
              purpose={purpose}
              granted={status?.granted ?? false}
              since={status?.since ?? null}
            />
          );
        })}
        <p className="text-xs text-muted-foreground">
          Dados de saúde/tratamento não dependem de consentimento (tutela da saúde). Consentimento aplica-se a imagem e divulgação religiosa.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direitos do titular (LGPD)</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
            Exportar dados
          </Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5"
            onClick={() => setConfirmOpen(true)}>
            <ShieldAlert size={14} className="mr-1.5" />
            Anonimizar (esquecimento)
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auditoria</h3>
        <AuditList residentId={residentId} />
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} /> Anonimizar dados do titular
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ação <strong>irreversível</strong>: remove nome, CPF, RG, contato, fotos e dados sensíveis de{' '}
              <strong>{residentName}</strong>, preservando apenas o histórico financeiro/legal exigido por lei.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => anonymize.mutate()}
              disabled={anonymize.isPending}
            >
              {anonymize.isPending ? 'Anonimizando…' : 'Confirmar anonimização'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
