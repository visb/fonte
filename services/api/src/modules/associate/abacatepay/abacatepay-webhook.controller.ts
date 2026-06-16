import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  AbacatePayWebhookPayload,
  AbacatePayWebhookService,
} from './abacatepay-webhook.service';

/**
 * Webhook do AbacatePay (story 38). SEM JWT — autenticado pelo secret
 * (`?webhookSecret=...` comparado a `ABACATEPAY_WEBHOOK_SECRET`). Idempotente
 * por `abacatepay_charge_id`. Sempre responde 200 quando o secret é válido
 * (mesmo para eventos não tratados) para o gateway não re-enfileirar.
 */
@Controller('webhooks/abacatepay')
export class AbacatePayWebhookController {
  constructor(private readonly webhookService: AbacatePayWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Query('webhookSecret') webhookSecret: string | undefined,
    @Body() payload: AbacatePayWebhookPayload,
  ) {
    this.webhookService.verifySecret(webhookSecret);
    return this.webhookService.handle(payload);
  }
}
