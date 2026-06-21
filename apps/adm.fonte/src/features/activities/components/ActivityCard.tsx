import { ArrowLeft, ArrowRight, Ban, Check, GripVertical, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_VARIANTS } from '../constants';
import { canTransition } from '../lib/transitions';
import { ResponsibleBadge } from './ResponsibleBadge';

interface Props {
  activity: Activity;
  isAdmin: boolean;
  role: string | null;
  userId: string | null;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onApprove: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onOpenDetails: (activity: Activity) => void;
}

/**
 * Botões espelham a matriz de transição do backend (que é a autoridade).
 * O backend rejeita o que o usuário não pode — aqui só evitamos oferecer
 * ações obviamente inválidas/sem permissão.
 */
export function ActivityCard({
  activity,
  isAdmin,
  role,
  userId,
  onChangeStatus,
  onApprove,
  onEdit,
  onDelete,
  onOpenDetails,
}: Props) {
  const { status } = activity;
  // "Devolver para rascunho" (story 75): criador ou ADMIN, espelhando o backend.
  const canReturnToDraft = canTransition(activity, ActivityStatus.DRAFT, {
    role,
    userId,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activity },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      data-activity-id={activity.id}
      className={`cursor-pointer rounded-md border bg-card p-3 shadow-sm space-y-2 hover:border-primary/40 ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onOpenDetails(activity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(activity);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Alça de arraste: o resto do card permanece clicável (abre detalhes). */}
        <button
          type="button"
          aria-label="Arrastar atividade"
          title="Arraste para mover de coluna"
          className="-ml-1 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <p className="flex-1 text-sm font-medium leading-tight">{activity.title}</p>
        <Badge variant={ACTIVITY_STATUS_VARIANTS[status]} className="shrink-0">
          {ACTIVITY_STATUS_LABELS[status]}
        </Badge>
      </div>

      {/* Descrição não aparece no board (story 71): só na tela/modal de detalhes. */}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {activity.house ? (
          <span className="rounded bg-muted px-1.5 py-0.5">{activity.house.name}</span>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">Geral</span>
        )}
        <ResponsibleBadge responsible={activity.responsible} />
      </div>

      <div
        className="flex flex-wrap items-center gap-1 pt-1"
        onClick={(e) => e.stopPropagation()}
      >
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

        {status === ActivityStatus.REQUESTED && canReturnToDraft && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChangeStatus(activity, ActivityStatus.DRAFT)}
          >
            <Undo2 size={12} className="mr-1" />
            Devolver para rascunho
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
