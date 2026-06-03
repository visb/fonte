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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MinistryService } from './ministry.service';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { CreateMinistryTaskDto } from './dto/create-ministry-task.dto';
import { UpdateMinistryTaskDto } from './dto/update-ministry-task.dto';
import { AddMinistryResidentDto, AddMinistryStaffDto } from './dto/add-ministry-member.dto';

@Controller('ministries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinistryController {
  constructor(private service: MinistryService) {}

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMinistryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  // â”€â”€â”€ Members: Residents (filhos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post(':id/residents')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  addResident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMinistryResidentDto,
  ): Promise<void> {
    return this.service.addResident(id, dto.residentId);
  }

  @Delete(':id/residents/:residentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  removeResident(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('residentId', ParseUUIDPipe) residentId: string,
  ): Promise<void> {
    return this.service.removeResident(id, residentId);
  }

  // â”€â”€â”€ Members: Staff (servos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Post(':id/staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  addStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMinistryStaffDto,
  ): Promise<void> {
    return this.service.addStaff(id, dto.staffId);
  }

  @Delete(':id/staff/:staffId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  removeStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<void> {
    return this.service.removeStaff(id, staffId);
  }

  // â”€â”€â”€ Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get(':id/tasks')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findTasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findTasks(id);
  }

  @Post(':id/tasks')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  createTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMinistryTaskDto,
  ) {
    return this.service.createTask(id, dto);
  }

  @Patch(':id/tasks/:taskId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateMinistryTaskDto,
  ) {
    return this.service.updateTask(id, taskId, dto);
  }

  @Delete(':id/tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  removeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    return this.service.removeTask(id, taskId);
  }
}
