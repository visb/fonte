import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Loader2, Paperclip, Users } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { useCreateResident } from '../../hooks/useResidents';
import { buildResidentPayload, type ResidentFormData } from '../../lib/residentSchema';
import { WizardActions } from './WizardActions';
import type { DraftRelative } from '../../lib/types';

interface ImportSummaryStepProps {
  residentValues: ResidentFormData;
  relatives: DraftRelative[];
  docxFile: File;
  photo: Blob | null;
  extraFiles: File[];
  onBack: () => void;
}

export function ImportSummaryStep({
  residentValues,
  relatives,
  docxFile,
  photo,
  extraFiles,
  onBack,
}: ImportSummaryStepProps) {
  const navigate = useNavigate();
  const createMutation = useCreateResident();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const includedRelatives = relatives.filter((r) => r.include && r.name.trim());

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Create resident
      const payload = {
        ...buildResidentPayload(residentValues),
        status: ResidentStatus.ACTIVE,
      };

      const resident = await new Promise<{ id: string }>((resolve, reject) => {
        createMutation.mutate(
          { data: payload as Parameters<typeof api.residents.create>[0], photo },
          { onSuccess: resolve, onError: reject },
        );
      });

      // 2. Create relatives
      for (const rel of includedRelatives) {
        try {
          await api.relatives.create({
            residentId: resident.id,
            name: rel.name.trim(),
            phone: rel.phone.trim() || null,
            relationship: rel.relationship.trim() || null,
          });
        } catch {
          // non-critical — continue
        }
      }

      // 3. Attach DOCX
      try {
        const fd = new FormData();
        fd.append('file', docxFile, docxFile.name);
        await api.residents.addAttachment(resident.id, fd);
      } catch {
        // non-critical — continue
      }

      // 4. Attach extra files (signed documents etc.)
      for (const file of extraFiles) {
        try {
          const fd = new FormData();
          fd.append('file', file, file.name);
          await api.residents.addAttachment(resident.id, fd);
        } catch {
          // non-critical — continue
        }
      }

      navigate(`/residents/${resident.id}?tab=attachments`);
    } catch (e) {
      setSaveError(getErrorMessage(e, 'Erro ao salvar o residente. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Resumo da importação</h2>
        <p className="text-sm text-muted-foreground">
          Revise o que será criado antes de confirmar.
        </p>
      </div>

      {/* Resident summary */}
      <section className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={16} className="text-primary" />
          Residente
        </div>
        <SummaryRow label="Nome" value={residentValues.name} />
        {residentValues.cpf && <SummaryRow label="CPF" value={residentValues.cpf} />}
        {residentValues.birthDate && (
          <SummaryRow
            label="Nascimento"
            value={new Date(residentValues.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          />
        )}
        {residentValues.entryDate && (
          <SummaryRow
            label="Entrada"
            value={new Date(residentValues.entryDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          />
        )}
        {residentValues.addiction && <SummaryRow label="Dependência" value={residentValues.addiction} />}
      </section>

      {/* Relatives summary */}
      {includedRelatives.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users size={16} className="text-primary" />
            Familiares ({includedRelatives.length})
          </div>
          {includedRelatives.map((rel) => (
            <div key={rel.id} className="text-sm flex items-center gap-2">
              <span className="font-medium">{rel.name}</span>
              {rel.relationship && (
                <span className="text-xs text-muted-foreground">({rel.relationship})</span>
              )}
              {rel.phone && <span className="text-xs text-muted-foreground">{rel.phone}</span>}
            </div>
          ))}
        </section>
      )}

      {/* Photo */}
      {photo && (
        <section className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={16} className="text-primary" />
            Foto de perfil
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Foto selecionada será salva como avatar do residente.
          </p>
        </section>
      )}

      {/* Attachments */}
      <section className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText size={16} className="text-primary" />
          Arquivos a anexar
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip size={12} />
          <span>{docxFile.name}</span>
          <span className="text-muted-foreground/50">(ficha original)</span>
        </div>
        {extraFiles.map((f) => (
          <div key={f.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Paperclip size={12} />
            <span>{f.name}</span>
          </div>
        ))}
      </section>

      {saveError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <WizardActions>
        <Button type="button" variant="outline" className="gap-2" onClick={onBack} disabled={saving}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving} className="gap-2 min-w-36">
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Salvando...
            </>
          ) : (
            'Confirmar e salvar'
          )}
        </Button>
      </WizardActions>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  );
}
