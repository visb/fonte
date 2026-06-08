import { SetMetadata } from '@nestjs/common';

// Marca handlers que PODEM revelar CPF/RG completos (detalhe de uma pessoa),
// desde que o solicitante seja ADMIN ou COORDINATOR. Listagens nunca recebem
// este decorator — são sempre mascaradas. Ver SensitiveDataInterceptor.
export const REVEAL_SENSITIVE_KEY = 'revealSensitive';
export const RevealSensitive = () => SetMetadata(REVEAL_SENSITIVE_KEY, true);
