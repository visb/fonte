import { useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { useCreateResident } from '../hooks/useResidents';
import { residentSchema, buildResidentPayload, type ResidentFormData } from '../lib/residentSchema';
import { ResidentFormSections } from '../components/ResidentFormSections';

const today = new Date().toISOString().split('T')[0];

export function NewResidentPage() {
  const navigate = useNavigate();
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: houses = [], isLoading: loadingHouses } = useHouses();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: { entryDate: today },
  });

  const createMutation = useCreateResident();

  const onSubmit = (data: ResidentFormData) => {
    const payload = { ...buildResidentPayload(data), status: ResidentStatus.ACTIVE };
    createMutation.mutate(
      { data: payload as Parameters<typeof api.residents.create>[0], photo: pendingPhotoRef.current },
      { onSuccess: (resident) => navigate(`/residents/${resident.id}?tab=attachments`) },
    );
  };

  if (loadingHouses) return <LoadingState />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/residents">
            <ArrowLeft size={16} />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Novo acolhimento</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div className="col-span-full flex justify-center pb-2">
          <AvatarUpload onBlobChange={(blob) => { pendingPhotoRef.current = blob; }} />
        </div>

        <ResidentFormSections register={register} errors={errors} houses={houses} />

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="outline" asChild>
            <Link to="/residents">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {isSubmitting || createMutation.isPending ? 'Salvando...' : 'Registrar acolhimento'}
          </Button>
        </div>
      </form>
    </div>
  );
}
