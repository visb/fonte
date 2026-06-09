import { Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Audit } from '../../common/decorators/audit.decorator';
import { RetentionService } from './retention.service';

@Controller('lgpd/retention')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  // Executa a purga/anonimização de internos expirados sob demanda. Só ADMIN.
  @Post('run')
  @Roles(Role.ADMIN)
  @Audit('lgpd.retention.run')
  run(): Promise<{ anonymized: number }> {
    return this.retentionService.purgeExpired();
  }
}
