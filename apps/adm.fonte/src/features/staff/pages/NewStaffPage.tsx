import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoBack } from '@/lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Eye, EyeOff } from 'lucide-react';
import { Role } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateStaff } from '../hooks/useStaff';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useSupportGroups } from '@/features/support-groups/hooks/useSupportGroups';
import { StaffFormSection } from '../components/StaffFormSection';
import { newStaffSchema, buildStaffPayload, type NewStaffFormData } from '../lib/staffSchema';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export function NewStaffPage() {
  const navigate = useNavigate();
  const goBack = useGoBack('/staff');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: houses = [] } = useHouses();
  const { data: supportGroups = [] } = useSupportGroups();

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } =
    useForm<NewStaffFormData>({
      resolver: zodResolver(newStaffSchema),
      defaultValues: { servesInGroup: false, rank: undefined },
    });

  useEffect(() => { setValue('password', generatePassword()); }, [setValue]);

  const servesInGroup = watch('servesInGroup');
  const role = watch('role');
  const createMutation = useCreateStaff();

  const onSubmit = (data: NewStaffFormData) => {
    createMutation.mutate(
      { ...buildStaffPayload(data), password: data.password },
      { onSuccess: () => navigate('/staff') },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getValues('password'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passwordSlot = (
    <div className="space-y-2">
      <Label htmlFor="password">Senha gerada *</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input id="password" type={showPassword ? 'text' : 'password'} {...register('password')} readOnly className="pr-9 font-mono" />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
          <Copy size={14} className="mr-1" />
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Só é usada se o servo tiver e-mail e acesso aos apps. Envie via WhatsApp; ele deverá alterá-la no primeiro acesso.</p>
    </div>
  );

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Novo Servo</h1>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {getErrorMessage(createMutation.error, 'Erro ao cadastrar servo.')}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <StaffFormSection
          register={register}
          errors={errors}
          role={role as Role | undefined}
          servesInGroup={servesInGroup}
          houses={houses}
          supportGroups={supportGroups}
          onSelectHouse={() => { setValue('servesInGroup', false); setValue('supportGroupId', ''); }}
          onSelectGroup={() => { setValue('servesInGroup', true); setValue('houseId', ''); }}
          passwordSlot={passwordSlot}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={goBack}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>Cadastrar</Button>
        </div>
      </form>
    </div>
  );
}
