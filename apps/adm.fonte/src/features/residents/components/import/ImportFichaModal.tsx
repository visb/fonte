import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import type { CommitImportRelative } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { residentSchema, type ResidentFormData } from '../../lib/residentSchema';
import {
  buildCommitPayload,
  previewToFormValues,
  relativesFromPreview,
  resolveHouseId,
} from '../../lib/importCommit';
import { IMPORT_TEXTS } from '../../constants';
import { ResidentFormSections } from '../ResidentFormSections';
import { ImportConflictAlert } from './ImportConflictAlert';
import { ImportFichaRelatives } from './ImportFichaRelatives';
import { useCheckImportConflict, useCommitImport, type ImportQueueItem } from '../../hooks/useBulkImport';

interface ImportFichaModalProps {
  item: ImportQueueItem;
  open: boolean;
  onClose: () => void;
  onApproved: (id: string) => void;
  sessionConflictName?: string | null;
}

/**
 * Modal da ficha completa e editável de um item do import em lote (story 105).
 * Dialog autossuficiente: recebe só o preview (via item) + o conflito de sessão,
 * e busca sozinho casas e conflito por nome/CPF. Reusa `ResidentFormSections`
 * (rhf + zod) — não recria o formulário. Aprovar persiste via `useCommitImport`.
 */
export function ImportFichaModal({
  item,
  open,
  onClose,
  onApproved,
  sessionConflictName,
}: ImportFichaModalProps) {
  const preview = item.preview;
  const { data: houses = [] } = useHouses();
  const commit = useCommitImport();

  const defaults = useMemo<ResidentFormData>(
    () =>
      ({
        name: '',
        houseId: '',
        gender: '',
        maritalStatus: '',
        familyInvestment: '',
        ...previewToFormValues(preview?.resident ?? {}),
      }) as ResidentFormData,
    [preview],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ResidentFormData>({ resolver: zodResolver(residentSchema), defaultValues: defaults });

  const [relatives, setRelatives] = useState<CommitImportRelative[]>(() =>
    preview ? relativesFromPreview(preview) : [],
  );

  // Casa a casa pelo nome (aba/ficha) assim que a lista de casas carrega.
  useEffect(() => {
    if (!watch('houseId') && houses.length > 0 && preview) {
      const id = resolveHouseId(preview.matchedHouseName ?? preview.houseName, houses);
      if (id) setValue('houseId', id);
    }
  }, [houses, preview, setValue, watch]);

  const name = typeof preview?.resident.name === 'string' ? preview.resident.name : null;
  const cpf = typeof preview?.resident.cpf === 'string' ? preview.resident.cpf : null;
  const conflictQuery = useCheckImportConflict(name, cpf, { enabled: open });
  const conflicts = conflictQuery.data?.conflicts ?? [];

  const namedRelatives = relatives.filter((r) => r.name.trim());
  const blockedReason = conflicts.length > 0
    ? IMPORT_TEXTS.conflictReason
    : sessionConflictName
      ? IMPORT_TEXTS.sessionConflictReason
      : namedRelatives.length === 0
        ? IMPORT_TEXTS.noRelativesReason
        : null;

  const onSubmit = (values: ResidentFormData) => {
    const payload = buildCommitPayload(values, {
      relatives: namedRelatives.map((r) => ({
        name: r.name.trim(),
        phone: r.phone?.trim() || null,
        relationship: r.relationship?.trim() || null,
      })),
      contributionMonths: preview?.contributionMonths ?? [],
      photoBase64: preview?.photoBase64,
    });
    commit.mutate(payload, { onSuccess: () => onApproved(item.id) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{IMPORT_TEXTS.modalTitle}</DialogTitle>
          <DialogDescription>{IMPORT_TEXTS.modalDescription}</DialogDescription>
        </DialogHeader>

        <ImportConflictAlert conflicts={conflicts} sessionConflictName={sessionConflictName} />

        {preview?.photoBase64 && (
          <img
            src={preview.photoBase64}
            alt={name ?? item.fileName}
            className="mx-auto h-24 w-24 rounded-lg object-cover"
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ResidentFormSections
            register={register}
            errors={errors}
            houses={houses}
            showStatus
            watchFamilyInvestment={watch('familyInvestment')}
          />

          <ImportFichaRelatives value={relatives} onChange={setRelatives} />

          {commit.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {getErrorMessage(commit.error, IMPORT_TEXTS.commitError)}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={commit.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="min-w-32 gap-2"
              disabled={!!blockedReason || commit.isPending}
              title={blockedReason ?? undefined}
            >
              {commit.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {IMPORT_TEXTS.approving}
                </>
              ) : (
                IMPORT_TEXTS.approve
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
