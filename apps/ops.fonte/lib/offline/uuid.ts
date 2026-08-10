/**
 * UUID v4 para a infra offline (chave de idempotência da story 172 e id local da
 * story 171).
 *
 * Módulo próprio porque tanto `outbox.ts` quanto `localIds.ts` precisam dele e o
 * `outbox` já depende do `localIds` — sem este arquivo o import seria circular.
 *
 * O Hermes (RN) não tem WebCrypto, e o backend rejeita com 400 chave fora do
 * formato UUID (`IdempotencyInterceptor`), então há fallback próprio.
 * Aleatoriedade fraca não é problema aqui: a chave só precisa ser única por
 * lançamento, não imprevisível.
 */
export function createUuid(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });
}
