import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AvatarUpload } from '@/components/AvatarUpload';
import { LoadingState } from '@/components/shared/LoadingState';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { residentSchema, type ResidentFormData } from '../../lib/residentSchema';
import { defaultImportState } from '../../lib/importCommit';
import { ResidentFormSections } from '../ResidentFormSections';
import { WizardActions } from './WizardActions';
import type { ParseResult } from '../../lib/types';

interface ImportReviewStepProps {
  parseResult: ParseResult;
  initialValues: Partial<ResidentFormData>;
  photo: Blob | null;
  onPhotoChange: (photo: Blob | null) => void;
  onBack: () => void;
  onNext: (values: ResidentFormData) => void;
}

export function ImportReviewStep({
  parseResult,
  initialValues,
  photo,
  onPhotoChange,
  onBack,
  onNext,
}: ImportReviewStepProps) {
  const { data: houses = [], isLoading: loadingHouses } = useHouses();

  // Object URL for the photo preview. Created inside an effect (not useMemo) so
  // each run owns a fresh URL and revokes only its own — safe under StrictMode's
  // mount/unmount/remount, which would otherwise revoke a still-referenced URL.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      name: '',
      houseId: '',
      gender: '',
      maritalStatus: '',
      familyInvestment: '',
      ...initialValues,
      // UF padrão "PR" quando a extração não trouxe a UF (story 119).
      state: defaultImportState(initialValues.state),
    },
  });

  // Auto-match house name to houseId once houses are loaded
  useEffect(() => {
    if (!loadingHouses && parseResult.houseName && houses.length > 0) {
      const normalise = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const target = normalise(parseResult.houseName);
      const found = houses.find((h) => normalise(h.name).includes(target) || target.includes(normalise(h.name)));
      if (found) setValue('houseId', found.id);
    }
  }, [loadingHouses, houses, parseResult.houseName, setValue]);

  // Re-apply parsed values whenever initialValues changes (e.g. user went back and re-uploaded)
  useEffect(() => {
    reset({
      name: '',
      houseId: '',
      gender: '',
      maritalStatus: '',
      familyInvestment: '',
      ...initialValues,
      // UF padrão "PR" também no re-upload/StrictMode (story 119).
      state: defaultImportState(initialValues.state),
    });
  }, [initialValues, reset]);

  if (loadingHouses) return <LoadingState />;

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold">Revisar dados do residente</h2>
          <p className="text-sm text-muted-foreground">
            Confira os dados extraídos da ficha e corrija o que for necessário.
          </p>
        </div>
      </div>

      {/* Foto do residente — extraída da ficha quando disponível */}
      <section className="space-y-1">
        <div className="flex justify-center py-1">
          <AvatarUpload currentUrl={photoUrl} onBlobChange={onPhotoChange} />
        </div>
        {photo && (
          <p className="text-xs text-center text-muted-foreground">
            {photoUrl
              ? 'Foto do residente — ajuste ou substitua se necessário.'
              : 'Foto selecionada — será salva ao confirmar.'}
          </p>
        )}
      </section>

      {parseResult.houseName && !watch('houseId') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-400">
          Casa detectada na ficha: <strong>{parseResult.houseName}</strong> — selecione a casa correspondente abaixo.
        </div>
      )}

      <ResidentFormSections
        register={register}
        errors={errors}
        houses={houses}
        watchFamilyInvestment={watch('familyInvestment')}
      />

      <WizardActions>
        <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>
        <Button type="submit" className="gap-2">
          Próximo: Familiares
          <ArrowRight size={14} />
        </Button>
      </WizardActions>
    </form>
  );
}
