import { useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { maskCPF, maskRG, maskPhone, withMask } from './masks';
import { Gender, MaritalStatus, ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface House {
  id: string;
  name: string;
}

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  houseId: z.string().min(1, 'Casa é obrigatória'),
  birthDate: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  entryDate: z.string().optional(),
  contactPhone: z.string().optional(),
  maritalStatus: z.string().optional(),
  children: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  religion: z.string().optional(),
  addiction: z.string().optional(),
  healthIssues: z.string().optional(),
  continuousMedication: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  familyInvestment: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const today = new Date().toISOString().split('T')[0];

const fetchHouses = () => api.get<House[]>('/houses').then((r) => r.data);

function buildPayload(data: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: ResidentStatus.ACTIVE };
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) continue;
    if (key === 'children' || key === 'weight' || key === 'height') {
      payload[key] = Number(value);
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-6 pb-2 border-b mb-4">
      {children}
    </h2>
  );
}

function Field({
  label,
  error,
  full,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'col-span-full space-y-1.5' : 'space-y-1.5'}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function NewResidentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pendingPhotoRef = useRef<Blob | null>(null);

  const { data: houses = [] } = useQuery({ queryKey: ['houses'], queryFn: fetchHouses });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { entryDate: today } });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: resident } = await api.post<{ id: string }>('/residents', buildPayload(data));
      const photo = pendingPhotoRef.current;
      if (photo) {
        const fd = new window.FormData();
        fd.append('file', photo, 'photo.jpg');
        await api.post(`/residents/${resident.id}/photo`, fd, {
          headers: { 'Content-Type': undefined },
        });
      }
      return resident;
    },
    onSuccess: (resident) => {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      navigate(`/residents/${resident.id}`, { state: { tab: 'attachments' } });
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

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
        <SectionTitle>Identificação</SectionTitle>

        <div className="col-span-full flex justify-center pb-2">
          <AvatarUpload onBlobChange={(blob) => { pendingPhotoRef.current = blob; }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome completo *" error={errors.name?.message} full>
            <Input {...register('name')} placeholder="Nome do acolhido" />
          </Field>
          <Field label="CPF">
            <Input {...withMask(register('cpf'), maskCPF)} placeholder="000.000.000-00" />
          </Field>
          <Field label="RG">
            <Input {...withMask(register('rg'), maskRG)} placeholder="00.000.000-0" />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" {...register('birthDate')} />
          </Field>
          <Field label="Gênero">
            <Select {...register('gender')}>
              <option value="">Selecione</option>
              <option value={Gender.MALE}>Masculino</option>
              <option value={Gender.FEMALE}>Feminino</option>
            </Select>
          </Field>
        </div>

        <SectionTitle>Admissão</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Casa *" error={errors.houseId?.message}>
            <Select {...register('houseId')}>
              <option value="">Selecione a casa</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data de entrada">
            <Input type="date" {...register('entryDate')} />
          </Field>
          <Field label="Endereço" full>
            <Input {...register('address')} placeholder="Rua, número, bairro, cidade" />
          </Field>
          <Field label="Telefone de contato">
            <Input {...withMask(register('contactPhone'), maskPhone)} placeholder="(00) 00000-0000" />
          </Field>
        </div>

        <SectionTitle>Perfil social</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Estado civil">
            <Select {...register('maritalStatus')}>
              <option value="">Selecione</option>
              <option value={MaritalStatus.SINGLE}>Solteiro(a)</option>
              <option value={MaritalStatus.MARRIED}>Casado(a)</option>
              <option value={MaritalStatus.DIVORCED}>Divorciado(a)</option>
            </Select>
          </Field>
          <Field label="Filhos">
            <Input type="number" min={0} {...register('children')} placeholder="0" />
          </Field>
          <Field label="Ocupação">
            <Input {...register('occupation')} placeholder="Profissão ou ocupação" />
          </Field>
          <Field label="Escolaridade">
            <Input {...register('education')} placeholder="Ex: Ensino médio completo" />
          </Field>
          <Field label="Religião">
            <Input {...register('religion')} placeholder="Ex: Evangélico, Católico..." />
          </Field>
          <Field label="Dependência química">
            <Input {...register('addiction')} placeholder="Ex: Álcool, crack..." />
          </Field>
        </div>

        <SectionTitle>Saúde</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Problemas de saúde" full>
            <Textarea {...register('healthIssues')} placeholder="Descreva condições de saúde relevantes" />
          </Field>
          <Field label="Medicação contínua" full>
            <Textarea {...register('continuousMedication')} placeholder="Liste os medicamentos em uso" />
          </Field>
          <Field label="Peso (kg)">
            <Input type="number" min={0} {...register('weight')} placeholder="70" />
          </Field>
          <Field label="Altura (cm)">
            <Input type="number" min={0} {...register('height')} placeholder="175" />
          </Field>
        </div>

        <SectionTitle>Família</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Investimento familiar" full>
            <Textarea
              {...register('familyInvestment')}
              placeholder="Descreva o envolvimento e apoio da família"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="outline" asChild>
            <Link to="/residents">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Registrar acolhimento'}
          </Button>
        </div>
      </form>
    </div>
  );
}
