import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BibleCourseService, ELIGIBLE_TREATMENT_MONTHS } from './bible-course.service';
import { BulkEnrollDto } from './dto/bulk-enroll.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpsertGradeDto } from './dto/upsert-grade.dto';

@Controller('bible-course')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BibleCourseController {
  constructor(private service: BibleCourseService) {}

  // ─── Modules (catalogo compartilhado, ADMIN) ─────────────────────────────────

  @Get('modules')
  @Roles(Role.ADMIN)
  findAllModules() {
    return this.service.findAllModules();
  }

  @Post('modules')
  @Roles(Role.ADMIN)
  createModule(@Body() dto: CreateModuleDto) {
    return this.service.createModule(dto);
  }

  @Patch('modules/:id')
  @Roles(Role.ADMIN)
  updateModule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.service.updateModule(id, dto);
  }

  @Delete('modules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  removeModule(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeModule(id);
  }

  // ─── Classes ───────────────────────────────────────────────────────────────

  @Get('classes')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findAllClasses(@Query('status') status?: string) {
    return this.service.findAllClasses(status);
  }

  @Post('classes')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  createClass(@Body() dto: CreateClassDto) {
    return this.service.createClass(dto);
  }

  // Precede `classes/:id` para não ser capturado pelo ParseUUIDPipe da rota dinâmica.
  @Get('classes/eligible-residents')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findEligibleResidents(
    @Query('months', new DefaultValuePipe(ELIGIBLE_TREATMENT_MONTHS), ParseIntPipe)
    months: number,
  ) {
    return this.service.findEligibleResidents(months);
  }

  @Get('classes/:id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findOneClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneClass(id);
  }

  @Patch('classes/:id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  updateClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.service.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removeClass(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeClass(id);
  }

  // ─── Enrollments ─────────────────────────────────────────────────────────────

  @Post('classes/:id/enrollments')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.service.enroll(id, dto);
  }

  @Post('classes/:id/enrollments/bulk')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  enrollBulk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkEnrollDto,
  ) {
    return this.service.enrollBulk(id, dto.residentIds);
  }

  @Patch('enrollments/:id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  updateEnrollment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.service.updateEnrollment(id, dto);
  }

  @Delete('enrollments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removeEnrollment(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeEnrollment(id);
  }

  // ─── Conclusão fora do sistema (story 127) ───────────────────────────────────

  @Post('residents/:residentId/external-completion')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  markExternalCompletion(
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markExternalCompletion(residentId, user?.userId ?? null);
  }

  @Delete('residents/:residentId/external-completion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  unmarkExternalCompletion(
    @Param('residentId', ParseUUIDPipe) residentId: string,
  ): Promise<void> {
    return this.service.unmarkExternalCompletion(residentId);
  }

  @Get('residents/:residentId/external-completion')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findExternalCompletion(@Param('residentId', ParseUUIDPipe) residentId: string) {
    return this.service.findExternalCompletion(residentId);
  }

  // ─── Grades (notas por módulo, ADMIN) ────────────────────────────────────────

  @Get('classes/:classId/grades')
  @Roles(Role.ADMIN)
  getClassGrades(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.service.getClassGrades(classId);
  }

  @Put('enrollments/:enrollmentId/grades/:moduleId')
  @Roles(Role.ADMIN)
  upsertGrade(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UpsertGradeDto,
  ) {
    return this.service.upsertGrade(enrollmentId, moduleId, dto);
  }
}
