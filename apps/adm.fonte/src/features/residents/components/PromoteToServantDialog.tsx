import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ServantRank } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { SERVANT_RANK_LABELS, SERVANT_RANK_ORDER } from '@/features/staff/constants';
import { usePromoteResidentToServant } from '../hooks/useResidents';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

const schema = z.object({
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  houseId: z.string().min(1, 'Casa é obrigatória'),
  rank: z.nativeEnum(ServantRank),
  date: z.string().min(1, 'Data é obrigatória'),
});
type FormData = z.infer<typeof schema>;

const TODAY = new Date().toISOString().split('T')[0];

interface Props {
  open: boolean;
  onClose: () => void;
  resident: Resident | null;
}

export function PromoteToServantDialog({ open, onClose, resident }: Props) {
  const navigate = useNavigate();
  const [password] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasAccess = !!resident?.userId;
  const { data: houses = [] } = useHouses();
  const mutation = usePromoteResidentToServant(resident?.id ?? '');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      email: '',
      houseId: resident?.houseId ?? '',
      rank: ServantRank.ASPIRANTE,
      date: TODAY,
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = (data: FormData) => {
    if (!resident) return;
    mutation.mutate(
      {
        houseId: data.houseId,
        rank: data.rank,
        date: data.date,
        ...(hasAccess ? {} : { email: data.email || undefined, password }),
      },
      { onSuccess: (staff) => { onClose(); navigate(`/staff/${staff.id}`); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tornar Servo</DialogTitle>
          <DialogDescription>
            Promove <strong>{resident?.name}</strong> a servo. O cadastro de filho é arquivado (alta).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="promote-house">Casa</Label>
              <select id="promote-house" {...register('houseId')} className={SELECT_CLASS}>
                <option value="">Selecione...</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {errors.houseId && <p className="text-xs text-destructive">{errors.houseId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="promote-rank">Nível</Label>
              <select id="promote-rank" {...register('rank')} className={SELECT_CLASS}>
                {SERVANT_RANK_ORDER.map((r) => (
                  <option key={r} value={r}>{SERVANT_RANK_LABELS[r]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promote-date">Data da promoção</Label>
              <Input id="promote-date" type="date" max={TODAY} {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            {hasAccess ? (
              <p className="text-xs text-muted-foreground">
                Este interno já tem acesso digital. O login atual será reaproveitado como conta de servo.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="promote-email">E-mail</Label>
                  <Input id="promote-email" type="email" placeholder="servo@fonte.org" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Senha gerada</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input type={showPassword ? 'text' : 'password'} value={password} readOnly className="pr-9 font-mono" />
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
                    Copie e envie esta senha ao novo servo via WhatsApp antes de confirmar.
                  </p>
                </div>
              </>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(mutation.error, 'Erro ao promover a servo.')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Promovendo...' : 'Tornar Servo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
