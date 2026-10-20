import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Admission } from './admission.entity';
import { AdmissionService } from './admission.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';

/**
 * Story 215 — escrita das passagens pela aba Histórico do adm (só ADMIN). A
 * leitura (`GET /residents/:id/admissions`) segue no `ResidentController`.
 * A auditoria (`admission.create`/`admission.update`) é gravada pelo service,
 * na transação da escrita — sem `@Audit` aqui para não duplicar.
 */
@Controller('residents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdmissionController {
  constructor(private admissionService: AdmissionService) {}

  @Post(':id/admissions')
  @Roles(Role.ADMIN)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAdmissionDto,
  ): Promise<Admission> {
    return this.admissionService.createAdmission(id, dto);
  }

  @Patch(':id/admissions/:admissionId')
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('admissionId', ParseUUIDPipe) admissionId: string,
    @Body() dto: UpdateAdmissionDto,
  ): Promise<Admission> {
    return this.admissionService.updateAdmission(id, admissionId, dto);
  }
}
