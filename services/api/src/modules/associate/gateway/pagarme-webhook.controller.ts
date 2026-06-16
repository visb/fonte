import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  PagarmeWebhookPayload,
  PagarmeWebhookService,
} from './pagarme-webhook.service';

/**
 * Webhook da Pagar.me (story 41). SEM JWT — autenticado por HTTP Basic
 * (usuário/senha configurados no painel Pagar.me, conferidos contra
 * `PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD`). Idempotente por
 * `gateway_charge_id`. Responde 200 quando autenticado (mesmo para eventos não
 * tratados) para o gateway não re-enfileirar.
 */
@Controller('webhooks/pagarme')
export class PagarmeWebhookController {
  constructor(private readonly webhookService: PagarmeWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: PagarmeWebhookPayload,
  ) {
    this.webhookService.verifyAuth(authorization);
    return this.webhookService.handle(payload);
  }
}
