import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';
import { api } from '@/lib/api';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/shared/LoadingState';
import { maskPhone, withMask } from '@/lib/masks';
import { useStaffMe, useUpdateStaffMe } from '@/features/staff/hooks/useStaff';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function ProfilePage() {
  const pendingPhotoRef = useRef<Blob | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { data: me, isLoading } = useStaffMe();
  const updateMutation = useUpdateStaffMe();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (me) {
      reset({
        name: me.name,
        email: me.user.email,
        phone: me.phone ?? '',
      });
    }
  }, [me, reset]);

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(
      {
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
        },
        photo: pendingPhotoRef.current,
      },
      {
        onSuccess: () => {
          pendingPhotoRef.current = null;
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edite suas informações pessoais
        </p>
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {getErrorMessage(updateMutation.error, 'Erro ao salvar alterações.')}
        </p>
      )}

      {updateMutation.isSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400 mb-4">
          Perfil atualizado com sucesso.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex justify-center pb-2">
          <AvatarUpload
            currentUrl={api.photoUrl(me?.photoUrl ?? null)}
            onBlobChange={(blob) => {
              pendingPhotoRef.current = blob;
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            {...withMask(register('phone'), maskPhone)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || updateMutation.isPending}
          >
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setChangePasswordOpen(true)}
          >
            <KeyRound size={14} />
            Alterar senha
          </Button>
        </div>
      </form>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
