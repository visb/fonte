import { IMPLEMENTED_RECEIPT_TYPES, RECEIPT_TYPE_LABELS, ReceiptType, TemplateKind } from '@fonte/types';
import type { DocumentTemplate } from '@fonte/api-client';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/errors';
import { useDocumentTemplates, useUpdateDocumentTemplate } from '../hooks/useDocumentTemplates';

interface Props {
  template: DocumentTemplate;
  /** Recebe o template com o tipo novo (o cabeçalho do editor acompanha). */
  onChanged: (updated: DocumentTemplate) => void;
}

/**
 * Story 212, decisão 3 — troca do tipo de um template de recibo, no editor.
 *
 * Oferece o tipo atual mais os tipos implementados ainda livres (um template
 * por tipo, regra da story 178). A troca grava na hora, pelo update existente,
 * mandando SÓ o `receiptType`: o conteúdo em edição não é tocado. Conflito (o
 * backend recusa tipo já usado) aparece com a mensagem do backend.
 */
export function ReceiptTypeField({ template, onChanged }: Props) {
  // Autossuficiente: busca os recibos para saber quais tipos já estão tomados.
  const { data: receiptTemplates = [] } = useDocumentTemplates(TemplateKind.RECEIPT);
  const updateMutation = useUpdateDocumentTemplate();

  const current = template.receiptType;
  const takenByOthers = receiptTemplates
    .filter((t) => t.id !== template.id)
    .map((t) => t.receiptType);
  const options = IMPLEMENTED_RECEIPT_TYPES.filter((t) => t === current || !takenByOthers.includes(t));
  if (current && !options.includes(current)) options.unshift(current);

  const handleChange = (value: string) => {
    if (!value || value === current) return;
    const receiptType = value as ReceiptType;
    updateMutation.mutate(
      { id: template.id, data: { receiptType } },
      // Só o tipo entra no estado da tela: o conteúdo devolvido pelo servidor
      // poderia sobrescrever uma edição ainda não salva.
      { onSuccess: (updated) => onChanged({ ...template, receiptType: updated.receiptType }) },
    );
  };

  return (
    <div className="space-y-1">
      <Label htmlFor="template-receipt-type" className="text-xs mb-1 block">
        Tipo de recibo
      </Label>
      <select
        id="template-receipt-type"
        className="h-8 rounded-md border bg-background px-2 text-sm"
        value={current ?? ''}
        disabled={updateMutation.isPending}
        onChange={(e) => handleChange(e.target.value)}
      >
        {!current && <option value="">Selecione o tipo</option>}
        {options.map((type) => (
          <option key={type} value={type}>
            {RECEIPT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      {updateMutation.isError && (
        <p className="text-xs text-destructive">
          {getErrorMessage(updateMutation.error, 'Erro ao trocar o tipo de recibo.')}
        </p>
      )}
    </div>
  );
}
