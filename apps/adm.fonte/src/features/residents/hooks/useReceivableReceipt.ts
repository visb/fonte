import { useCallback, useState } from 'react';
import { residentReceiptFilename, type ReceiptType } from '@fonte/types';
import { api } from '@/lib/api';
import { getErrorMessage, getMissingReceiptTemplateType, parseBlobError } from '@/lib/errors';
import { triggerDownload } from '@/lib/download';

/** Story 212, decisão 6 — dados da linha que dão nome ao arquivo baixado. */
export interface ReceivableReceiptFile {
  residentName: string;
  referenceMonth: string;
}

/**
 * Story 193 — download do recibo de uma parcela PAGA do carnê do filho.
 *
 * Espelha o `useChargeReceipt` (story 178) e pelo mesmo motivo não é
 * `useMutation`: não muda estado de servidor visível na tela (o único efeito é a
 * alocação idempotente do número) e não há cache a invalidar — é um download.
 *
 * O erro fica local à aba, com `getErrorMessage`: o 404 de template ausente
 * chega ao operador como a frase acionável do backend ("Cadastre em
 * Configurações → Templates"), e não como erro genérico de axios.
 *
 * Story 212 — o corpo de erro chega como `Blob` (`responseType: 'blob'`) e é
 * lido por `parseBlobError`; o 404 `RECEIPT_TEMPLATE_MISSING` expõe
 * `missingTemplateType` para a tela oferecer o atalho "Cadastrar template". O
 * arquivo sai como `recibo-{filho}-{MM}-{AAAA}.pdf`, montado com os dados da
 * linha (sem ler o `Content-Disposition`).
 */
export function useReceivableReceipt() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingTemplateType, setMissingTemplateType] = useState<ReceiptType | null>(null);

  const download = useCallback(
    async (residentId: string, receivableId: string, file: ReceivableReceiptFile) => {
      setDownloadingId(receivableId);
      setError(null);
      setMissingTemplateType(null);
      try {
        const blob = await api.residents.receivableReceipt(residentId, receivableId);
        triggerDownload(blob, residentReceiptFilename(file.residentName, file.referenceMonth));
      } catch (e) {
        const parsed = await parseBlobError(e);
        setError(getErrorMessage(parsed, 'Falha ao gerar o recibo. Tente novamente em instantes.'));
        setMissingTemplateType(getMissingReceiptTemplateType(parsed));
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  const dismissError = useCallback(() => {
    setError(null);
    setMissingTemplateType(null);
  }, []);

  return { downloadingId, error, missingTemplateType, dismissError, download };
}
