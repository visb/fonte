import type { BibleCourseExternalCompletion } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { useUnmarkExternalCompletion } from '@/features/bible-courses/hooks/useBibleCourses';

interface Props {
  residentId: string;
  residentName: string;
  completion: BibleCourseExternalCompletion;
  /** ADMIN/COORDINATOR — mesmas roles do endpoint da marcação (decisão 4). */
  canManage: boolean;
}

/** `markedAt` é timestamp ISO completo (não data pura como `entryDate`). */
function formatMarkedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/**
 * Valor do campo "Curso bíblico" da ficha (story 127): o filho concluiu o curso
 * FORA do sistema, com auditoria de quem marcou e quando.
 *
 * "Remover marcação" é o desfazer permanente (decisão 5) — o outro caminho é o
 * "Desfazer" do toast, logo após marcar. `markedBy` nulo = quem marcou já foi
 * removido (FK ON DELETE SET NULL): o fato sobrevive ao staff, então o texto
 * omite o autor em vez de mostrar vazio.
 */
export function ResidentBibleCourseField({
  residentId,
  residentName,
  completion,
  canManage,
}: Props) {
  const unmark = useUnmarkExternalCompletion();
  const markedBy = completion.markedBy?.name;

  return (
    <span className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        Concluído fora do sistema
        {markedBy ? ` · marcado por ${markedBy}` : ''} em {formatMarkedAt(completion.markedAt)}
      </span>
      {canManage && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={unmark.isPending}
          onClick={() => unmark.mutate({ residentId, residentName })}
        >
          Remover marcação
        </Button>
      )}
    </span>
  );
}
