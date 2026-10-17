import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { RelativePaidReceivable, Role } from '@fonte/types';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { GenerateRelativeAccessDto } from './dto/generate-relative-access.dto';
import { ResetRelativePasswordDto } from './dto/reset-relative-password.dto';
import { UpdateRelativeMeDto } from './dto/update-relative-me.dto';
import { Relative } from './relative.entity';
import { RelativeMeView, RelativeService } from './relative.service';
import { ReceiptService } from '../receipt/receipt.service';

const photoOptions = { storage: memoryStorage() };

@Controller('relatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelativeController {
  constructor(
    private relativeService: RelativeService,
    // Story 193 — o download do recibo do familiar. Último parâmetro: o
    // anterior é contrato do spec existente deste controller.
    private receiptService: ReceiptService,
  ) {}

  @Get('me')
  @Roles(Role.RELATIVE)
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<RelativeMeView> {
    return this.relativeService.findMe(user.userId);
  }

  @Patch('me')
  @Roles(Role.RELATIVE)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRelativeMeDto,
  ): Promise<RelativeMeView> {
    return this.relativeService.updateMe(user.userId, dto);
  }

  @Post('me/photo')
  @Roles(Role.RELATIVE)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<RelativeMeView> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Apenas imagens sÃ£o permitidas');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB');
    return this.relativeService.uploadPhoto(user.userId, file);
  }

  /**
   * Story 193 — parcelas PAGAS do filho do familiar logado.
   *
   * Declarada antes de qualquer rota com parâmetro pelo mesmo motivo do
   * `:id/receivables/summary` do ResidentController: o Nest casa a primeira
   * rota compatível.
   */
  @Get('me/receivables')
  @Roles(Role.RELATIVE)
  findMyReceivables(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RelativePaidReceivable[]> {
    return this.relativeService.findMyPaidReceivables(user.userId);
  }

  /**
   * Story 193 — o familiar baixa o recibo da PRÓPRIA parcela.
   *
   * O escopo é do service (decisão 10): parcela de outro filho responde 404, e
   * a checagem roda antes da alocação do número — tentativa negada não queima
   * sequência.
   */
  @Get('me/receivables/:receivableId/receipt')
  @Roles(Role.RELATIVE)
  @Audit('relative.receivable.receipt', 'resident-receivable', 'receivableId', {
    context: () => ({ format: 'pdf', count: 1 }),
  })
  async downloadMyReceivableReceipt(
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.receiptService.generateForResidentReceivable(
      receivableId,
      user.userId,
      { relativeUserId: user.userId },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findByResident(
    @Query('residentId', ParseUUIDPipe) residentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Relative[]> {
    return this.relativeService.findByResident(residentId, { role: user.role, userId: user.userId });
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateRelativeDto): Promise<Relative> {
    return this.relativeService.create(dto);
  }

  @Patch(':id/responsible')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  setResponsible(@Param('id', ParseUUIDPipe) id: string): Promise<Relative> {
    return this.relativeService.setResponsible(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.relativeService.remove(id);
  }

  @Post(':id/access')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  generateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateRelativeAccessDto,
  ): Promise<Relative> {
    return this.relativeService.generateAccess(id, dto.email, dto.password);
  }

  @Post(':id/access/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetRelativePasswordDto,
  ): Promise<void> {
    return this.relativeService.resetPassword(id, dto.password);
  }
}
