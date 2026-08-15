import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReceiptService } from './receipt.service';

/**
 * Story 178 — download do recibo da contribuição mensal.
 *
 * Vive em `associates/charges/:chargeId/receipt` porque o sujeito do recibo é a
 * COBRANÇA, não o associado. Três segmentos após `associates` — não colide com
 * o `GET /associates/:id` do AssociateController.
 *
 * ADMIN e COORDINATOR: quem confere o livro de recibos é quem administra. O PDF
 * é gerado na hora e nunca persistido (decisão 4 do plano).
 */
@Controller('associates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Get('charges/:chargeId/receipt')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @Audit('associate.charge.receipt', 'associate-charge')
  async downloadChargeReceipt(
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.receiptService.generateForAssociateCharge(
      chargeId,
      user.userId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
