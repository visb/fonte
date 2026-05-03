import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Copy, Eye, EyeOff } from 'lucide-react';
import { Role } from '@fonte/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskPhone, withMask } from '../residents/masks';

interface House {
  id: string;
  name: string;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6),
  role: z.enum([Role.ADMIN, Role.COORDINATOR, Role.OPERATOR], {
    required_error: 'Função é obrigatória',
  }),
  houseId: z.string().min(1, 'Casa é obrigatória'),
  phone: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function NewStaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: houses = [] } = useQuery<House[]>({
    queryKey: ['houses'],
    queryFn: () => api.get<House[]>('/houses').then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setValue('password', generatePassword());
  }, [setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/staff', {
        ...data,
        phone: data.phone || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      navigate('/staff');
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(getValues('password'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/staff')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Novo Servo</h1>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Erro ao cadastrar servo.'}
        </p>
      )}

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register('name')} placeholder="Nome completo" />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" {...register('email')} placeholder="servo@fonte.org" />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha gerada *</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                readOnly
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              <Copy size={14} className="mr-1" />
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie esta senha ao servo via WhatsApp. Ele deverá alterá-la no primeiro acesso.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Função *</Label>
          <select id="role" {...register('role')} className={SELECT_CLASS}>
            <option value="">Selecione...</option>
            <option value={Role.ADMIN}>Administrador</option>
            <option value={Role.COORDINATOR}>Coordenador</option>
            <option value={Role.OPERATOR}>Operador</option>
          </select>
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="houseId">Casa *</Label>
          <select id="houseId" {...register('houseId')} className={SELECT_CLASS}>
            <option value="">Selecione...</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          {errors.houseId && <p className="text-sm text-destructive">{errors.houseId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            {...withMask(register('phone'), maskPhone)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/staff')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            Cadastrar
          </Button>
        </div>
      </form>
    </div>
  );
}
