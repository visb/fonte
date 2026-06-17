import { ArrowLeft, ArrowRight, Ban, Check, Pencil, Send, Trash2 } from 'lucide-react';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_VARIANTS } from '../constants';

interface Props {
  activity: Activity;
  isAdmin: boolean;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onApprove: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

/**
 * Botões espelham a matriz de transição do backend (que é a autoridade).
 * O backend rejeita o que o usuário não pode — aqui só evitamos oferecer
 * ações obviamente inválidas/sem permissão.
 */
export function ActivityCard({
  activity,
  isAdmin,
  onChangeStatus,
  onApprove,
  onEdit,
  onDelete,
}: Props) {
  const { status } = activity;

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{activity.title}</p>
        <Badge variant={ACTIVITY_STATUS_VARIANTS[status]} className="shrink-0">
          {ACTIVITY_STATUS_LABELS[status]}
        </Badge>
      </div>

      {activity.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">{activity.description}</p>
      )}

      <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {activity.house ? (
          <span className="rounded bg-muted px-1.5 py-0.5">{activity.house.name}</span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">Geral</span>
        )}
        {activity.responsible && (
          <span className="rounded bg-muted px-1.5 py-0.5">
            {activity.responsible.name}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 pt-1">
        {status === ActivityStatus.DRAFT && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.REQUESTED)}>
            <Send size={12} className="mr-1" />
            Enviar
          </Button>
        )}

        {status === ActivityStatus.REQUESTED && isAdmin && (
          <Button size="sm" onClick={() => onApprove(activity)}>
            <Check size={12} className="mr-1" />
            Aprovar
          </Button>
        )}

        {status === ActivityStatus.TODO && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.DOING)}>
            <ArrowRight size={12} className="mr-1" />
            Iniciar
          </Button>
        )}

        {status === ActivityStatus.DOING && (
          <>
            <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.TODO)}>
              <ArrowLeft size={12} className="mr-1" />
              Voltar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.BLOCKED)}>
              <Ban size={12} className="mr-1" />
              Impedir
            </Button>
            <Button size="sm" onClick={() => onChangeStatus(activity, ActivityStatus.DONE)}>
              <Check size={12} className="mr-1" />
              Concluir
            </Button>
          </>
        )}

        {status === ActivityStatus.BLOCKED && (
          <>
            <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.DOING)}>
              <ArrowLeft size={12} className="mr-1" />
              Retomar
            </Button>
            <Button size="sm" onClick={() => onChangeStatus(activity, ActivityStatus.DONE)}>
              <Check size={12} className="mr-1" />
              Concluir
            </Button>
          </>
        )}

        {status === ActivityStatus.DONE && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus(activity, ActivityStatus.DOING)}>
            <ArrowLeft size={12} className="mr-1" />
            Reabrir
          </Button>
        )}

        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          title="Editar"
          onClick={() => onEdit(activity)}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
          title="Excluir"
          onClick={() => onDelete(activity)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
