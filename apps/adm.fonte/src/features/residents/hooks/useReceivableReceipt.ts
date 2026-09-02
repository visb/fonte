import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { triggerDownload } from '@/lib/download';

/**
 * Story 193 — download do recibo de uma parcela PAGA do carnê do filho.
 *
 * Espelha o `useChargeReceipt` (story 178) e pelo mesmo motivo não é
 * `useMutation`: não muda estado de servidor visível na tela (o único efeito é a
 * alocação idempotente do número) e não há cache a invalidar — é um download.
 *
 * O erro fica local à linha, com `getErrorMessage`: o 404 de template ausente
 * chega ao operador como a frase acionável do backend ("Cadastre em
 * Configurações → Templates"), e não como erro genérico de axios.
 */
export function useReceivableReceipt() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (residentId: string, receivableId: string) => {
    setDownloadingId(receivableId);
    setError(null);
    try {
      const blob = await api.residents.receivableReceipt(residentId, receivableId);
      triggerDownload(blob, `recibo-${receivableId}.pdf`);
    } catch (e) {
      setError(getErrorMessage(e, 'Falha ao gerar o recibo. Tente novamente em instantes.'));
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return {
    downloadingId,
    error,
    dismissError: useCallback(() => setError(null), []),
    download,
  };
}
