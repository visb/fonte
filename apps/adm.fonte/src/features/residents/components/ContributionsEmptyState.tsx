import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';

interface Props {
  /** O acolhimento selecionado é o vigente? */
  isCurrent: boolean;
  /** Acolhimento vigente sem plano de contribuição definido e sem isenção. */
  planUndefined: boolean;
  onChangePlan: () => void;
}

/**
 * Estado vazio da aba Contribuições (story 164, decisão 10).
 *
 * "Nenhuma parcela" tem três causas diferentes e a UI precisa distinguir: sem o
 * aviso de plano faltando, a readmissão sem plano some em silêncio — foi assim
 * que um filho ficou com o carnê do acolhimento atual vazio.
 *
 * A aba só chega aqui com quem pode gerenciar (ADMIN/COORDINATOR) — quem não
 * pode nem enxerga a contribuição —, então o CTA não precisa de guarda extra.
 */
export function ContributionsEmptyState({ isCurrent, planUndefined, onChangePlan }: Props) {
  if (!isCurrent) {
    return <EmptyState title="Nenhuma parcela neste acolhimento." />;
  }

  if (planUndefined) {
    return (
      <EmptyState
        title="Plano de contribuição não definido."
        description="Defina o plano para gerar o carnê deste acolhimento."
        action={
          <Button variant="outline" size="sm" onClick={onChangePlan}>
            <Pencil size={14} className="mr-1.5" />
            Alterar plano
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Nenhuma parcela gerada."
      description="Plano social ou acolhido isento não geram parcelas."
    />
  );
}
