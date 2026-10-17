/**
 * Story 193 — utilidades do download do recibo no React Native.
 *
 * O RN não tem `Blob` que sirva para escrever arquivo: o PDF chega como
 * `ArrayBuffer` e precisa virar base64 para o `FileSystem.writeAsStringAsync`.
 * As duas funções aqui são PURAS de propósito — é o que permite testar a
 * conversão e a leitura da mensagem de erro sem mexer em `expo-file-system`.
 */

import { residentReceiptFilename } from '@fonte/types';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * `ArrayBuffer` → base64, sem depender de `btoa`/`Buffer` (nenhum dos dois é
 * garantido no Hermes). Implementação canônica de 3 bytes → 4 caracteres, com o
 * padding `=` do resto.
 */
export function bytesToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/**
 * Caminho do PDF no cache. `cacheDirectory` é anulável (web/SSR não têm) e o
 * template cru imprimiria `null/recibo-....pdf`; aqui o nome do arquivo
 * sobrevive sozinho.
 *
 * Story 212, decisão 6 — o nome é `recibo-{filho}-{MM}-{AAAA}.pdf` (helper
 * único de `@fonte/types`, o mesmo do servidor e do `adm`). Dois filhos
 * homônimos na mesma competência sobrescrevem o arquivo: aceitável, o cache só
 * serve para compartilhar na hora.
 */
export function receiptFileUri(
  cacheDirectory: string | null | undefined,
  residentName: string | null | undefined,
  referenceMonth: string | null | undefined,
): string {
  return `${cacheDirectory ?? ''}${residentReceiptFilename(residentName, referenceMonth)}`;
}

/**
 * Mensagem do backend num erro cujo corpo veio como `ArrayBuffer`.
 *
 * Com `responseType: 'arraybuffer'`, o axios entrega TAMBÉM o corpo de erro
 * como buffer — o `getErrorMessage` de sempre veria um objeto binário e cairia
 * no fallback, escondendo do familiar a frase acionável ("Cadastre em
 * Configurações → Templates"). Aqui o buffer é decodificado como UTF-8 (a frase
 * tem acento) e o `message` é extraído; qualquer falha devolve `null`, e o
 * chamador usa o fallback.
 */
export function messageFromBinaryError(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data) return null;
  const bytes =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : ArrayBuffer.isView(data as ArrayBufferView)
        ? new Uint8Array((data as ArrayBufferView).buffer)
        : null;
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(decodeUtf8(bytes)) as { message?: string | string[] };
    const message = parsed?.message;
    if (Array.isArray(message)) return message.join(', ');
    return typeof message === 'string' && message ? message : null;
  } catch {
    return null;
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  const Decoder = (globalThis as { TextDecoder?: new () => { decode(input: Uint8Array): string } })
    .TextDecoder;
  if (Decoder) return new Decoder().decode(bytes);
  // Hermes sem TextDecoder: o truque clássico de %-escapes reconstrói o UTF-8.
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return decodeURIComponent(
    binary
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
}
