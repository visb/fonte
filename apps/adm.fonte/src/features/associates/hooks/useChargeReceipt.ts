import { useCallback, useState } from 'react';
import type { ReceiptType } from '@fonte/types';
import { api } from '@/lib/api';
import { getErrorMessage, getMissingReceiptTemplateType, parseBlobError } from '@/lib/errors';
// Story 193 — o `<a download>` virou helper compartilhado quando o segundo
// recibo (o do acolhido) precisou exatamente do mesmo caminho.
import { triggerDownload } from '@/lib/download';

/**
 * Story 178 — download do recibo de uma cobrança PAGA.
 *
 * Não é `useMutation` porque não muda estado de servidor visível na tela (o
 * único efeito é a alocação idempotente do número) e não há cache a invalidar:
 * é um download. O erro fica local, com `getErrorMessage` — o 404 de template
 * ausente chega ao operador como a frase acionável do backend, e não como erro
 * genérico de axios.
 *
 * Story 212 — o corpo de erro em `Blob` é lido por `parseBlobError`, e o 404
 * `RECEIPT_TEMPLATE_MISSING` expõe `missingTemplateType` (atalho "Cadastrar
 * template"). O nome do arquivo do associado fica como estava (fora de escopo).
 */
export function useChargeReceipt() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingTemplateType, setMissingTemplateType] = useState<ReceiptType | null>(null);

  const download = useCallback(async (chargeId: string) => {
    setDownloadingId(chargeId);
    setError(null);
    setMissingTemplateType(null);
    try {
      const blob = await api.associates.chargeReceipt(chargeId);
      triggerDownload(blob, `recibo-${chargeId}.pdf`);
    } catch (e) {
      const parsed = await parseBlobError(e);
      setError(getErrorMessage(parsed, 'Falha ao gerar o recibo. Tente novamente em instantes.'));
      setMissingTemplateType(getMissingReceiptTemplateType(parsed));
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setMissingTemplateType(null);
  }, []);

  return { downloadingId, error, missingTemplateType, dismissError, download };
}
