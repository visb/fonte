import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

/**
 * Story 178 — download do recibo de uma cobrança PAGA.
 *
 * Não é `useMutation` porque não muda estado de servidor visível na tela (o
 * único efeito é a alocação idempotente do número) e não há cache a invalidar:
 * é um download. O erro fica local à linha, com `getErrorMessage` — o 404 de
 * template ausente chega ao operador como a frase acionável do backend, e não
 * como erro genérico de axios.
 */
export function useChargeReceipt() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (chargeId: string) => {
    setDownloadingId(chargeId);
    setError(null);
    try {
      const blob = await api.associates.chargeReceipt(chargeId);
      triggerDownload(blob, `recibo-${chargeId}.pdf`);
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
