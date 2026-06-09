import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Audit } from '../../common/decorators/audit.decorator';
import { ConsentRecord, ConsentPurpose, ConsentSubjectType } from './consent-record.entity';
import { ConsentService, ConsentStatusView } from './consent.service';
import { RegisterConsentDto, PurposeDto } from './dto/register-consent.dto';

@Controller('consents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  // ─── Autoatendimento do titular (familiar/interno) ──────────────────────────

  // Estado do próprio consentimento (titular resolvido pelo JWT).
  @Get('me')
  @Roles(Role.RELATIVE, Role.RESIDENT)
  async myStatus(@CurrentUser() user: AuthenticatedUser): Promise<ConsentStatusView[]> {
    const subject = await this.consentService.resolveSubjectForUser(user.userId, user.profileType);
    return this.consentService.statusForSubject(subject.subjectType, subject.subjectId);
  }

  // Concede consentimento próprio para uma finalidade.
  @Post('me/grant')
  @Roles(Role.RELATIVE, Role.RESIDENT)
  @Audit('consent.self_grant', 'consent', 'userId')
  async myGrant(
    @Body() dto: PurposeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsentRecord> {
    const subject = await this.consentService.resolveSubjectForUser(user.userId, user.profileType);
    return this.consentService.grant(
      subject.subjectType,
      subject.subjectId,
      dto.purpose,
      dto.termVersion ?? null,
      user.userId,
    );
  }

  // Revoga consentimento próprio para uma finalidade.
  @Post('me/revoke')
  @Roles(Role.RELATIVE, Role.RESIDENT)
  @Audit('consent.self_revoke', 'consent', 'userId')
  async myRevoke(
    @Body() dto: PurposeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsentRecord> {
    const subject = await this.consentService.resolveSubjectForUser(user.userId, user.profileType);
    return this.consentService.revoke(subject.subjectType, subject.subjectId, dto.purpose, user.userId);
  }

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

  // Gate: verifica se há consentimento ativo para uma finalidade. Use antes de
  // publicar imagem/divulgação religiosa. Declarado antes das rotas com
  // parâmetros para não ser capturado por :subjectType/:subjectId.
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
}
