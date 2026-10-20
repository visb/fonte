import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gender } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { getCpfConflict, getErrorMessage } from '@/lib/errors';
import { applyCpfConflict, cpfField } from '@/lib/cpf';
import { CpfFieldError } from '@/components/shared/CpfFieldError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { maskCPF, maskRG, withMask } from '@/lib/masks';
import { birthDateField, maxBirthDate } from '@/lib/birthDate';
import { useUpdateResidentIdentity } from '../hooks/useResidents';

// Correção dos "dados de identidade" na reintrodução (story 147). Só o ADMIN
// abre este dialog (gate no banner + no backend). Pré-preenche com os valores
// atuais que o ADMIN recebe completos (RevealSensitive) e usa as máscaras de
// input já existentes — sem reaplicar formatador sobre valor redigido.
// Story 202: o nascimento carregado só é julgado (18+) se for alterado.
// Story 219: CPF com DV válido só quando muda (o carregado pode ser legado).
const makeSchema = (initialBirthDate?: string | null, initialCpf?: string | null) =>
  z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    cpf: cpfField(initialCpf),
    rg: z.string().optional(),
    birthDate: birthDateField(initialBirthDate),
    gender: z.nativeEnum(Gender).or(z.literal('')).optional(),
  });

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

interface Props {
  open: boolean;
  onClose: () => void;
  resident: Resident;
}

// O valor cru vem só com dígitos (ADMIN); redigido (`***`) não deve ser
// remascarado. `displayCpf`/`displayRg` já tratam isso, mas aqui o form parte do
// dígito cru — o ADMIN sempre recebe completo — então a máscara de input basta.
const onlyDigits = (v?: string) => (v ? v.replace(/\D/g, '') : '');

export function EditResidentIdentityDialog({ open, onClose, resident }: Props) {
  const mutation = useUpdateResidentIdentity(resident.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(resident.birthDate, resident.cpf)),
    defaultValues: {
      name: resident.name ?? '',
      cpf: resident.cpf ? maskCPF(onlyDigits(resident.cpf)) : '',
      rg: resident.rg ? maskRG(resident.rg.replace(/[^0-9Xx]/g, '')) : '',
      birthDate: resident.birthDate ? resident.birthDate.slice(0, 10) : '',
      gender: (resident.gender as Gender) ?? '',
    },
  });

  const handleClose = () => {
    reset();
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    const cpfDigits = onlyDigits(values.cpf);
    const rgClean = (values.rg ?? '').replace(/[^0-9Xx]/g, '');
    mutation.mutate(
      {
        name: values.name.trim(),
        cpf: cpfDigits || null,
        rg: rgClean || null,
        birthDate: values.birthDate || null,
        gender: (values.gender || null) as Gender | null,
      },
      {
        onSuccess: handleClose,
        onError: (error) => {
          applyCpfConflict(error, setError);
        },
      },
    );
  };
  // O 409 de CPF já aparece no campo (com o link); o resto vai no rodapé.
  const showSubmitError = mutation.isError && !getCpfConflict(mutation.error);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Corrigir dados de identificação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Nome *" error={errors.name?.message}>
            <Input {...register('name')} />
          </FormField>

          <FormField label="CPF">
            <Input {...withMask(register('cpf'), maskCPF)} placeholder="000.000.000-00" />
            <CpfFieldError error={errors.cpf} />
          </FormField>

          <FormField label="RG">
            <Input {...withMask(register('rg'), maskRG)} placeholder="00.000.000-0" />
          </FormField>

          <FormField label="Data de nascimento" error={errors.birthDate?.message}>
            <ControlledDateInput control={control} name="birthDate" max={maxBirthDate()} />
          </FormField>

          <FormField label="Gênero">
            <Select {...register('gender')}>
              <option value="">Selecione</option>
              <option value={Gender.MALE}>Masculino</option>
              <option value={Gender.FEMALE}>Feminino</option>
            </Select>
          </FormField>

          {showSubmitError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao corrigir os dados.')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
