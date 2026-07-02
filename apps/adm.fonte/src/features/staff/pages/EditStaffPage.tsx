import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { AvatarUpload } from '@/components/AvatarUpload';
import { useGoBack } from '@/lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Role } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { useUpdateStaff, useStaffById } from '../hooks/useStaff';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useSupportGroups } from '@/features/support-groups/hooks/useSupportGroups';
import { StaffFormSection } from '../components/StaffFormSection';
import { editStaffSchema, buildStaffPayload, staffToFormValues, type EditStaffFormData } from '../lib/staffSchema';

export function EditStaffPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/staff');
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: houses = [], isLoading: loadingHouses } = useHouses();
  const { data: supportGroups = [], isLoading: loadingGroups } = useSupportGroups();
  const { data: staff, isLoading } = useStaffById(id!);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<EditStaffFormData>({ resolver: zodResolver(editStaffSchema) });

  useEffect(() => {
    if (staff && !loadingHouses && !loadingGroups) reset(staffToFormValues(staff));
  }, [staff, loadingHouses, loadingGroups, reset]);

  const servesInGroup = watch('servesInGroup');
  const role = watch('role');
  const updateMutation = useUpdateStaff(id!);

  const onSubmit = (data: EditStaffFormData) => {
    updateMutation.mutate(
      { data: buildStaffPayload(data), photo: pendingPhotoRef.current },
      { onSuccess: () => goBack() },
    );
  };

  if (isLoading || loadingHouses || loadingGroups) return <LoadingState />;

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Editar Servo</h1>
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {getErrorMessage(updateMutation.error, 'Erro ao salvar alterações.')}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex justify-center pb-2">
          <AvatarUpload
            currentUrl={api.photoUrl(staff?.photoUrl ?? null)}
            onBlobChange={(blob) => { pendingPhotoRef.current = blob; }}
          />
        </div>

        <StaffFormSection
          register={register}
          errors={errors}
          role={role as Role | undefined}
          servesInGroup={servesInGroup}
          houses={houses}
          supportGroups={supportGroups}
          onSelectHouse={() => { setValue('servesInGroup', false); setValue('supportGroupId', ''); }}
          onSelectGroup={() => { setValue('servesInGroup', true); setValue('houseId', ''); }}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={goBack}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>Salvar</Button>
        </div>
      </form>
    </div>
  );
}
