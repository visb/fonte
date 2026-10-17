import { RECEIPT_TEMPLATE_MISSING_CODE, ReceiptType } from '@fonte/types';

type ApiErrorData = {
  message?: string | string[];
  /** Story 212 — código legível por máquina (ex.: `RECEIPT_TEMPLATE_MISSING`). */
  code?: string;
  receiptType?: string;
};
type ApiError = { response?: { status?: number; data?: ApiErrorData | Blob } };

/** O erro da API é um 404 (recurso não existe mais). */
export function isNotFoundError(error: unknown): boolean {
  return (error as ApiError)?.response?.status === 404;
}

function errorData(error: unknown): ApiErrorData | undefined {
  const data = (error as ApiError)?.response?.data;
  if (!data || isBlob(data)) return undefined;
  return data;
}

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const message = errorData(error)?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

/** Story 212 — o `code` do corpo de erro da API, quando houver. */
export function getErrorCode(error: unknown): string | undefined {
  return errorData(error)?.code;
}

/**
 * Story 212, decisão 7 — o tipo de recibo cujo template falta, quando o erro é o
 * 404 `RECEIPT_TEMPLATE_MISSING`. Qualquer outro erro (inclusive o 404 de
 * "parcela inexistente") devolve `null`.
 */
export function getMissingReceiptTemplateType(error: unknown): ReceiptType | null {
  const data = errorData(error);
  if (data?.code !== RECEIPT_TEMPLATE_MISSING_CODE) return null;
  const type = data.receiptType;
  return (Object.values(ReceiptType) as string[]).includes(type ?? '')
    ? (type as ReceiptType)
    : null;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * Story 212 — download com `responseType: 'blob'` recebe o CORPO DE ERRO também
 * como `Blob`, e aí `getErrorMessage`/`getErrorCode` não enxergam nada. Este
 * helper lê o JSON de dentro do Blob e devolve um erro com `response.data` já
 * como objeto. Erro sem Blob, ou Blob que não é JSON, volta intacto.
 */
export async function parseBlobError(error: unknown): Promise<unknown> {
  const response = (error as ApiError)?.response;
  if (!response || !isBlob(response.data)) return error;
  try {
    const data = JSON.parse(await blobToText(response.data)) as ApiErrorData;
    return { ...(error as object), response: { ...response, data } };
  } catch {
    return error;
  }
}
