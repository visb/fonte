import { useNavigate } from 'react-router-dom';
import type { ReceiptType } from '@fonte/types';
import { Button } from '@/components/ui/button';

/** Query param que abre o dialog de novo recibo com o tipo pré-escolhido. */
export const NEW_RECEIPT_PARAM = 'newReceipt';

/** Story 212, decisão 8 — destino do atalho "Cadastrar template". */
export function newReceiptTemplatePath(type: ReceiptType): string {
  return `/settings/templates?${NEW_RECEIPT_PARAM}=${type}`;
}

interface Props {
  message: string;
  /** Tipo cujo template falta (404 `RECEIPT_TEMPLATE_MISSING`); `null` = erro comum. */
  missingTemplateType: ReceiptType | null;
}

/**
 * Story 212, decisão 4 — erro do download de recibo. Quando a falha é template
 * ausente, ganha o atalho que abre Configurações → Templates com o dialog de
 * novo recibo já no tipo certo (pré-seleção intencional: vem do erro).
 */
export function ReceiptErrorAlert({ message, missingTemplateType }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-2" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      {missingTemplateType && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(newReceiptTemplatePath(missingTemplateType))}
        >
          Cadastrar template
        </Button>
      )}
    </div>
  );
}
