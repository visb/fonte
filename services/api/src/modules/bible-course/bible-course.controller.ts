import {
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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BibleCourseService } from './bible-course.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

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
}
