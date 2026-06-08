import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Audit } from '../../common/decorators/audit.decorator';
import { ConsentRecord, ConsentPurpose, ConsentSubjectType } from './consent-record.entity';
import { ConsentService, ConsentStatusView } from './consent.service';
import { RegisterConsentDto } from './dto/register-consent.dto';

@Controller('consents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  // Registra o consentimento (concessão) de um titular para uma finalidade.
  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  @Audit('consent.grant', 'consent', 'subjectId')
  grant(
    @Body() dto: RegisterConsentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsentRecord> {
    return this.consentService.grant(
      dto.subjectType,
      dto.subjectId,
      dto.purpose,
      dto.termVersion ?? null,
      user.userId,
    );
  }

  // Revoga o consentimento de um titular para uma finalidade.
  @Post('revoke')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  @Audit('consent.revoke', 'consent', 'subjectId')
  revoke(
    @Body() dto: RegisterConsentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsentRecord> {
    return this.consentService.revoke(dto.subjectType, dto.subjectId, dto.purpose, user.userId);
  }

  // Estado consolidado de consentimento de um titular.
  @Get(':subjectType/:subjectId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  status(
    @Param('subjectType') subjectType: ConsentSubjectType,
    @Param('subjectId') subjectId: string,
  ): Promise<ConsentStatusView[]> {
    return this.consentService.statusForSubject(subjectType, subjectId);
  }

  // Histórico completo (prova) de concessões/revogações.
  @Get(':subjectType/:subjectId/history')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  history(
    @Param('subjectType') subjectType: ConsentSubjectType,
    @Param('subjectId') subjectId: string,
  ): Promise<ConsentRecord[]> {
    return this.consentService.history(subjectType, subjectId);
  }

  // Gate: verifica se há consentimento ativo para uma finalidade. Use antes de
  // publicar imagem/divulgação religiosa.
  @Get('check/active')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  check(
    @Query('subjectType') subjectType: ConsentSubjectType,
    @Query('subjectId') subjectId: string,
    @Query('purpose') purpose: ConsentPurpose,
  ): Promise<{ active: boolean }> {
    return this.consentService
      .hasActiveConsent(subjectType, subjectId, purpose)
      .then((active) => ({ active }));
  }
}
