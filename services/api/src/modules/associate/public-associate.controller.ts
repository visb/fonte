import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AssociatePaymentService } from './associate-payment.service';
import { SubscribeDto } from './dto/subscribe.dto';

/**
 * Endpoints PÚBLICOS do checkout do associado (story 38). SEM JWT — acesso por
 * `payment_token`. Throttle por IP para mitigar enumeração de tokens e abuso.
 */
@Controller('public/associates')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PublicAssociateController {
  constructor(private readonly paymentService: AssociatePaymentService) {}

  /** Dados mínimos para pré-preencher a página pública. Não vaza dados sensíveis. */
  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.paymentService.getPublicView(token);
  }

  /** Adesão à recorrência: calcula gross-up, cria assinatura, persiste 1ª cobrança PENDING. */
  @Post(':token/subscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(@Param('token') token: string, @Body() dto: SubscribeDto) {
    return this.paymentService.subscribe(token, dto);
  }
}
