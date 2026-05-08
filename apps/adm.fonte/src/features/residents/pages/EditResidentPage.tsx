import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
  residentSchema,
  buildResidentPayload,
  residentToFormValues,
  type ResidentFormData,
} from '../lib/residentSchema';
import { ResidentFormSections } from '../components/ResidentFormSections';

export function EditResidentPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/residents');
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: resident, isLoading: loadingResident } = useResidentById(id!);
  const { data: houses = [] } = useHouses();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResidentFormData>({ resolver: zodResolver(residentSchema) });

  useEffect(() => {
    if (resident) reset(residentToFormValues(resident));
  }, [resident, reset]);

  const updateMutation = useUpdateResident(id!);

  const onSubmit = (data: ResidentFormData) => {
    updateMutation.mutate(
      {
        data: buildResidentPayload(data) as Parameters<typeof api.residents.update>[1],
        photo: pendingPhotoRef.current,
      },
      { onSuccess: () => goBack() },
    );
  };

  if (loadingResident) return <LoadingState />;

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
          errors={errors}
          houses={houses}
          showStatus
        />

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
