import { Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { AssociateChargeScheduler } from './associate-charge.scheduler';

/**
 * Disparo manual de cobrança WhatsApp de um associado (story 39).
 *
 * Apenas ADMIN. Respeita o mesmo dedupe de 5 dias do scheduler diário e os
 * mesmos gatilhos (PENDING vencido → ADHESION, PAST_DUE → REACTIVATION).
 * ACTIVE/CANCELED ou associado inexistente retornam `{ sent: false, skipped: true }`.
 */
@Controller('associates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssociateChargeController {
  constructor(private readonly scheduler: AssociateChargeScheduler) {}

  @Post(':id/charge')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  charge(@Param('id') id: string): Promise<{ sent: boolean; skipped: boolean }> {
    return this.scheduler.chargeManually(id);
  }
}
