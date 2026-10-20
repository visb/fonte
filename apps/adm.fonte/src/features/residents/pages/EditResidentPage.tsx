import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useGoBack } from '@/lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useResidentById } from '../hooks/useResidents';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { useUpdateResident } from '../hooks/useResidents';
import {
  makeResidentSchema,
  buildResidentPayload,
  residentToFormValues,
  type ResidentFormData,
} from '../lib/residentSchema';
import { ResidentFormSections } from '../components/ResidentFormSections';
import { applyCpfConflict } from '@/lib/cpf';
import { getCpfConflict, getErrorMessage } from '@/lib/errors';

export function EditResidentPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/residents');
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: resident, isLoading: loadingResident } = useResidentById(id!);
  const { data: houses = [], isLoading: loadingHouses } = useHouses();
  // Story 202: nascimento legado (menor) só é julgado se for alterado.
  const initialBirthDate = resident?.birthDate ?? null;
  // Story 203: entrada/saída legadas incoerentes só são julgadas se alteradas.
  const initialEntryDate = resident?.entryDate ?? null;
  const initialExitDate = resident?.exitDate ?? null;
  // Story 219: CPF legado inválido só é julgado se for alterado.
  const initialCpf = resident?.cpf ?? null;
  const schema = useMemo(
    () =>
      makeResidentSchema({
        initialBirthDate,
        initialAdmissionDates: { entryDate: initialEntryDate, exitDate: initialExitDate },
        initialCpf,
      }),
    [initialBirthDate, initialEntryDate, initialExitDate, initialCpf],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResidentFormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (resident && !loadingHouses) reset(residentToFormValues(resident));
  }, [resident, loadingHouses, reset]);

  const updateMutation = useUpdateResident(id!);

  const onSubmit = (data: ResidentFormData) => {
    updateMutation.mutate(
      {
        data: buildResidentPayload(data) as Parameters<typeof api.residents.update>[1],
        photo: pendingPhotoRef.current,
      },
      {
        onSuccess: () => goBack(),
        // Story 219: CPF em uso → erro no campo com link para o cadastro.
        onError: (error) => {
          applyCpfConflict(error, setError);
        },
      },
    );
  };
  const submitError =
    updateMutation.isError && !getCpfConflict(updateMutation.error)
      ? getErrorMessage(updateMutation.error, 'Erro ao salvar o acolhimento.')
      : null;

  if (loadingResident || loadingHouses) return <LoadingState />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold">Editar acolhimento</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div className="col-span-full flex justify-center pb-2">
          <AvatarUpload
            currentUrl={api.photoUrl(resident?.photoUrl ?? null)}
            onBlobChange={(blob) => { pendingPhotoRef.current = blob; }}
          />
        </div>

        <ResidentFormSections
          register={register}
          control={control}
          errors={errors}
          houses={houses}
          showStatus
          watchFamilyInvestment={watch('familyInvestment')}
        />

        {submitError && <p className="text-sm text-destructive pt-4">{submitError}</p>}

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="outline" onClick={goBack}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
            {isSubmitting || updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
