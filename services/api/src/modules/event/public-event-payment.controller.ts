import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { EventPaymentService } from './event-payment.service';
import { PayEventDto } from './dto/pay-event.dto';

/**
 * Endpoints PÚBLICOS do pagamento da inscrição (story 69). SEM JWT — acesso por
 * `payment_token`. Throttle por IP para mitigar enumeração de tokens e abuso
 * (mesmo padrão do checkout dos associados, story 38/41).
 */
@Controller('public/event-payments')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicEventPaymentController {
  constructor(private readonly service: EventPaymentService) {}

  /** Dados da inscrição p/ a página de pagamento. 404 token inválido. */
  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.service.getPublicView(token);
  }

  /** Cria a cobrança avulsa (cartão/PIX). Throttle estrito. Idempotente (409 já-pago). */
  @Post(':token/pay')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  pay(@Param('token') token: string, @Body() dto: PayEventDto) {
    return this.service.pay(token, dto);
  }
}
