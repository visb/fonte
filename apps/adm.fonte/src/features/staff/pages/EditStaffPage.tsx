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
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/shared/FormField';
import { LoadingState } from '@/components/shared/LoadingState';
import { PersonalDataFields } from '@/components/shared/PersonalDataFields';
import { useUpdateStaff, useStaffById } from '../hooks/useStaff';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useSupportGroups } from '@/features/support-groups/hooks/useSupportGroups';
import { StaffServiceSelector } from '../components/StaffServiceSelector';
import { SERVANT_RANK_LABELS, SERVANT_RANK_ORDER } from '../constants';
import { editStaffSchema, buildStaffPayload, staffToFormValues, type EditStaffFormData } from '../lib/staffSchema';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function EditStaffPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/staff');
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: houses = [] } = useHouses();
  const { data: supportGroups = [] } = useSupportGroups();
  const { data: staff, isLoading } = useStaffById(id!);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<EditStaffFormData>({ resolver: zodResolver(editStaffSchema) });

  useEffect(() => {
    if (staff) reset(staffToFormValues(staff));
  }, [staff, reset]);

  const servesInGroup = watch('servesInGroup');
  const role = watch('role');
  const updateMutation = useUpdateStaff(id!);

  const onSubmit = (data: EditStaffFormData) => {
    updateMutation.mutate(
      { data: buildStaffPayload(data), photo: pendingPhotoRef.current },
      { onSuccess: () => goBack() },
    );
  };

  if (isLoading) return <LoadingState />;

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

        <PersonalDataFields register={register} errors={errors} namePlaceholder="Nome completo" />

        <SectionTitle>Conta e serviço</SectionTitle>

        <div className="space-y-2">
          <Label htmlFor="role">Função *</Label>
          <select id="role" {...register('role')} className={SELECT_CLASS}>
            <option value={Role.ADMIN}>Administrador</option>
            <option value={Role.COORDINATOR}>Coordenador</option>
            <option value={Role.SERVANT}>Servo</option>
          </select>
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        </div>

        {role === Role.SERVANT && (
          <div className="space-y-2">
            <Label htmlFor="rank">Nível</Label>
            <select id="rank" {...register('rank')} className={SELECT_CLASS}>
              {SERVANT_RANK_ORDER.map((r) => (
                <option key={r} value={r}>{SERVANT_RANK_LABELS[r]}</option>
              ))}
            </select>
          </div>
        )}

        <StaffServiceSelector
          servesInGroup={servesInGroup}
          onSelectHouse={() => { setValue('servesInGroup', false); setValue('supportGroupId', ''); }}
          onSelectGroup={() => { setValue('servesInGroup', true); setValue('houseId', ''); }}
          houses={houses}
          supportGroups={supportGroups}
          houseIdReg={register('houseId')}
          supportGroupIdReg={register('supportGroupId')}
          houseIdError={errors.houseId?.message}
          supportGroupIdError={errors.supportGroupId?.message}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={goBack}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>Salvar</Button>
        </div>
      </form>
    </div>
  );
}
