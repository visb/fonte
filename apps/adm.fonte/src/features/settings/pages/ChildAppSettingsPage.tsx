import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Smartphone } from 'lucide-react';
import { TimerResetFrequency } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/shared/LoadingState';
import { useAppSettings, useUpdateAppSettings } from '../hooks/useAppSettings';
import { getErrorMessage } from '@/lib/errors';

const schema = z.object({
  timerResetFrequency: z.nativeEnum(TimerResetFrequency),
  dailyUsageMinutes: z.coerce.number().int().min(5).max(120),
});

type FormData = z.infer<typeof schema>;

const FREQUENCY_LABELS: Record<TimerResetFrequency, string> = {
  [TimerResetFrequency.DAILY]: 'Diária',
  [TimerResetFrequency.WEEKLY]: 'Semanal',
  [TimerResetFrequency.BIWEEKLY]: 'Quinzenal',
};

export function ChildAppSettingsPage() {
  const { data: settings, isLoading } = useAppSettings();
  const { mutate, isPending, error } = useUpdateAppSettings();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { timerResetFrequency: TimerResetFrequency.DAILY, dailyUsageMinutes: 20 },
  });

  useEffect(() => {
    if (settings) {
      reset({ timerResetFrequency: settings.timerResetFrequency, dailyUsageMinutes: settings.dailyUsageMinutes });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold">App para filhos</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure o tempo de uso e a frequência de reset do timer no app dos residentes.
      </p>

      <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-6 max-w-sm">
        <div className="space-y-2">
          <Label>Frequência de reset do timer</Label>
          <div className="flex gap-2">
            {Object.values(TimerResetFrequency).map((freq) => (
              <label key={freq} className="flex-1">
                <input type="radio" value={freq} {...register('timerResetFrequency')} className="sr-only peer" />
                <span className="block text-center text-sm px-3 py-2 rounded-md border cursor-pointer transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary hover:border-foreground">
                  {FREQUENCY_LABELS[freq]}
                </span>
              </label>
            ))}
          </div>
          {errors.timerResetFrequency && (
            <p className="text-xs text-destructive">{errors.timerResetFrequency.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dailyUsageMinutes">Tempo de uso permitido (minutos)</Label>
          <Input
            id="dailyUsageMinutes"
            type="number"
            min={5}
            max={120}
            {...register('dailyUsageMinutes')}
          />
          {errors.dailyUsageMinutes && (
            <p className="text-xs text-destructive">{errors.dailyUsageMinutes.message}</p>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{getErrorMessage(error)}</p>}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
}
