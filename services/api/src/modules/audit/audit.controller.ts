import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Trilha de auditoria de um recurso (ex. acessos a um interno). Só ADMIN.
  @Get(':targetType/:targetId')
  @Roles(Role.ADMIN)
  findByTarget(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ): Promise<AuditLog[]> {
    return this.auditService.findByTarget(targetType, targetId);
  }
}
