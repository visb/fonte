import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';
import { bytesToBase64, messageFromBinaryError, receiptFileUri } from '../lib/receiptFile';

const DOWNLOAD_FALLBACK = 'Falha ao gerar o recibo. Tente novamente em instantes.';

/**
 * Story 193 — parcelas PAGAS do filho do familiar logado.
 *
 * Sem parâmetro: o backend resolve o filho pelo VÍNCULO do token, e a tela
 * nunca manda um id de filho. Só o que já foi pago entra (decisão 11).
 */
export function useMyPaidReceivables() {
  return useQuery({
    queryKey: queryKeys.contributions.myPaid,
    queryFn: () => api.relatives.myPaidReceivables(),
  });
}

/**
 * Story 193 — baixa o recibo de uma parcela paga e abre o compartilhamento
 * nativo (salvar, WhatsApp, e-mail…).
 *
 * Mesmo caminho do QR Code do `ops.fonte`: `arraybuffer` → base64 →
 * `FileSystem.cacheDirectory` → `Sharing.shareAsync`. Cache, e não document
 * directory: o PDF é descartável — quem quiser guardar, guarda pelo menu de
 * compartilhamento.
 *
 * Não é `useMutation` pelo mesmo motivo do `adm.fonte`: não há estado de
 * servidor visível na tela nem cache a invalidar — é um download.
 */
export function useReceivableReceipt() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (receivableId: string) => {
    setDownloadingId(receivableId);
    setError(null);
    try {
      const data = await api.relatives.receivableReceipt(receivableId, {
        responseType: 'arraybuffer',
      });
      const uri = receiptFileUri(FileSystem.cacheDirectory, receivableId);
      await FileSystem.writeAsStringAsync(uri, bytesToBase64(data as ArrayBuffer), {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Recibo da contribuição',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      // O corpo do erro também vem binário: sem decodificar, a frase acionável
      // do backend viraria o fallback genérico.
      setError(messageFromBinaryError(e) ?? getErrorMessage(e, DOWNLOAD_FALLBACK));
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
