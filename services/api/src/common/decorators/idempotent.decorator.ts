import { SetMetadata } from '@nestjs/common';

/**
 * Marca um handler de escrita como idempotente (story 172). O
 * `IdempotencyInterceptor` reserva a chave do header `Idempotency-Key` antes de
 * executar e memoriza a resposta de sucesso; o reenvio da mesma chave recebe a
 * resposta original **sem executar o handler de novo**.
 *
 * O header NÃO é obrigatório: sem ele a requisição segue o comportamento de
 * hoje (decisão 8) — adm.fonte, portal e Postman existentes não mudam.
 */
export const IDEMPOTENT_KEY = 'idempotent';

export const Idempotent = () => SetMetadata<string, boolean>(IDEMPOTENT_KEY, true);
