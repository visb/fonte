import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Activity } from '@fonte/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useActivity, useUpdateActivity } from '../hooks/useActivities';
import { canEditDescription } from '../lib/permissions';
import { ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_VARIANTS } from '../constants';
import { ActivityComments } from './ActivityComments';

interface Props {
  activityId: string | null;
  open: boolean;
  onClose: () => void;
}

const descriptionSchema = z.object({
  description: z.string().optional(),
});
type DescriptionForm = z.infer<typeof descriptionSchema>;

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ActivityDetailsDialog({ activityId, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {open && activityId && (
          <ActivityDetails activityId={activityId} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Conteúdo autossuficiente: busca a atividade pelo id e cuida do detalhe + edição. */
function ActivityDetails({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const { role, userId } = useAuth();
  const { data: activity, isLoading, error, refetch } = useActivity(activityId, {
    enabled: true,
  });

  if (isLoading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Atividade</DialogTitle>
        </DialogHeader>
        <LoadingState />
      </>
    );
  }

  if (error || !activity) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Atividade</DialogTitle>
        </DialogHeader>
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar a atividade.')}
          onRetry={refetch}
        />
      </>
    );
  }

  const editable = canEditDescription(activity, { role, userId });

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-3 pr-6">
          <DialogTitle className="leading-tight">{activity.title}</DialogTitle>
          <Badge variant={ACTIVITY_STATUS_VARIANTS[activity.status]} className="shrink-0">
            {ACTIVITY_STATUS_LABELS[activity.status]}
          </Badge>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
          <InfoRow label="Casa" value={activity.house?.name ?? 'Geral (sem casa)'} />
          <InfoRow
            label="Responsável"
            value={activity.responsible?.name ?? 'Não atribuído'}
          />
          <InfoRow label="Criado por" value={activity.createdBy?.name ?? '—'} />
          <InfoRow label="Criada em" value={formatDateTime(activity.createdAt)} />
          <InfoRow label="Atualizada em" value={formatDateTime(activity.updatedAt)} />
        </div>

        <DescriptionSection
          activity={activity}
          editable={editable}
          onClose={onClose}
        />

        {/* Abas inferiores: Comentários (story 65) | Histórico (preenchido na story 66). */}
        <ActivityTabs activityId={activity.id} />
      </div>
    </>
  );
}

type DetailsTab = 'comments' | 'history';

function ActivityTabs({ activityId }: { activityId: string }) {
  const [tab, setTab] = useState<DetailsTab>('comments');

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b" role="tablist">
        <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
          Comentários
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          Histórico
        </TabButton>
      </div>

      {tab === 'comments' ? (
        <ActivityComments activityId={activityId} />
      ) : (
        <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          Histórico em breve.
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </button>
  );
}

function DescriptionSection({
  activity,
  editable,
  onClose,
}: {
  activity: Activity;
  editable: boolean;
  onClose: () => void;
}) {
  const updateMutation = useUpdateActivity();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<DescriptionForm>({
    resolver: zodResolver(descriptionSchema),
    defaultValues: { description: activity.description ?? '' },
  });

  useEffect(() => {
    reset({ description: activity.description ?? '' });
  }, [activity.description, reset]);

  const onSubmit = (data: DescriptionForm) => {
    updateMutation.mutate(
      { id: activity.id, data: { description: data.description ? data.description : null } },
      { onSuccess: () => updateMutation.reset() },
    );
  };

  if (!editable) {
    return (
      <div className="space-y-1">
        <Label>Descrição</Label>
        {activity.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {activity.description}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sem descrição.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Label htmlFor="activity-details-description">Descrição</Label>
      <Textarea
        id="activity-details-description"
        {...register('description')}
        placeholder="Descreva a atividade"
        rows={4}
      />
      {updateMutation.error != null && (
        <p className="text-xs text-destructive">
          {getErrorMessage(updateMutation.error, 'Erro ao salvar a descrição.')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
          {updateMutation.isPending ? 'Salvando...' : 'Salvar descrição'}
        </Button>
      </div>
    </form>
  );
}
