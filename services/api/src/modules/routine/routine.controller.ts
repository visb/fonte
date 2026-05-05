import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { RoutineService } from './routine.service';
import { CreateRoutineEntryDto } from './dto/create-routine-entry.dto';
import { UpdateRoutineEntryDto } from './dto/update-routine-entry.dto';

@Controller('routines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutineController {
  constructor(private service: RoutineService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(
    @Query('houseId') houseId?: string,
    @Query('residentId') residentId?: string,
  ) {
    return this.service.findAll(houseId, residentId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  create(@Body() dto: CreateRoutineEntryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoutineEntryDto,
  ) {
    return this.service.update(id, dto);
  }
}
