import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Audit } from '../../common/decorators/audit.decorator';
import { DataRightsService } from './data-rights.service';

// LGPD art. 18 — direitos do titular sobre dados de internos.
@Controller('residents/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataRightsController {
  constructor(private readonly dataRightsService: DataRightsService) {}

  // Portabilidade (art. 20): exporta todos os dados pessoais do interno em JSON.
  @Get('data-export')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @Audit('resident.data_export', 'resident')
  exportData(@Param('id', ParseUUIDPipe) id: string): Promise<Record<string, unknown>> {
    return this.dataRightsService.exportResident(id);
  }

  // Eliminação/anonimização (art. 18, IV): irreversível. Só ADMIN.
  @Post('anonymize')
  @Roles(Role.ADMIN)
  @Audit('resident.anonymize', 'resident')
  anonymize(@Param('id', ParseUUIDPipe) id: string): Promise<{ anonymized: boolean; residentId: string }> {
    return this.dataRightsService.anonymizeResident(id);
  }
}
