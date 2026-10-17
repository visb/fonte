import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditEventDetail, AuditEventPage, AuditQueryService } from './audit-query.service';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';

// Toda a trilha é exclusiva de ADMIN. Nenhuma rota edita ou apaga evento.
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly queryService: AuditQueryService,
  ) {}

  // Story 199 — listagem filtrada e paginada por cursor.
  @Get()
  list(@Query() dto: ListAuditEventsDto): Promise<AuditEventPage> {
    return this.queryService.list(dto);
  }

  // Story 199 — detalhe com antes/depois. Declarada ANTES da rota legada de dois
  // parâmetros: `events/:id` casaria `:targetType/:targetId`.
  @Get('events/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AuditEventDetail> {
    return this.queryService.findOne(id);
  }

  // Trilha de auditoria de um recurso (ex. acessos a um interno). Contrato legado.
  @Get(':targetType/:targetId')
  findByTarget(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ): Promise<AuditLog[]> {
    return this.auditService.findByTarget(targetType, targetId);
  }
}
