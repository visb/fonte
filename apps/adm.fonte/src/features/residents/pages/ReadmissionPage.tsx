import { useNavigate, useParams } from 'react-router-dom';
import { ResidentStatus } from '@fonte/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useResidentById } from '../hooks/useResidents';
import { ReadmissionForm } from '../components/ReadmissionForm';

const READMITTABLE = new Set<ResidentStatus>([ResidentStatus.DISCHARGED, ResidentStatus.EVADED]);

export function ReadmissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: resident, isLoading, isError } = useResidentById(id!);

  if (isLoading) return <LoadingState />;
  if (isError || !resident) return <ErrorState message="Acolhido não encontrado." />;

  if (!READMITTABLE.has(resident.status)) {
    return (
      <ErrorState message="Este acolhido não pode ser reintroduzido. Apenas filhos com status Alta ou Evasão podem ser reintroduzidos." />
    );
  }

  return (
    <ReadmissionForm
      resident={resident}
      onBack={() => navigate(`/residents/${id}`)}
      onSuccess={(newId) => navigate(`/residents/${newId}?tab=attachments`)}
    />
  );
}
