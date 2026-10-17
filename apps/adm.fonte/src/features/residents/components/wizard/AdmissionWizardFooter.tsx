import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraftSavedIndicator } from './DraftSavedIndicator';

interface AdmissionWizardFooterProps {
  step: number;
  isLast: boolean;
  advancing: boolean;
  /** ISO do último salvamento do rascunho (story 211). */
  draftSavedAt: string | null;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}

/** Rodapé do wizard de acolhimento: navegação entre passos + indicador do rascunho. */
export function AdmissionWizardFooter({
  step,
  isLast,
  advancing,
  draftSavedAt,
  onCancel,
  onBack,
  onNext,
  onFinish,
}: AdmissionWizardFooterProps) {
  return (
    <div className="pt-6 space-y-2">
      <div className="flex justify-between gap-3">
        {step === 0 ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onBack} disabled={advancing}>
            <ArrowLeft size={16} className="mr-1.5" />
            Voltar
          </Button>
        )}

        {isLast ? (
          <Button type="button" onClick={onFinish} disabled={advancing}>
            <Check size={16} className="mr-1.5" />
            {advancing ? 'Concluindo...' : 'Concluir acolhimento'}
          </Button>
        ) : (
          <Button type="button" onClick={onNext} disabled={advancing}>
            {advancing ? 'Salvando...' : 'Avançar'}
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <DraftSavedIndicator savedAt={draftSavedAt} />
      </div>
    </div>
  );
}
