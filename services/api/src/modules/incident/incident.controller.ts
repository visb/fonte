import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentController {
  constructor(private service: IncidentService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findAll(
    @Query('houseId') houseId?: string,
    @Query('residentId') residentId?: string,
  ) {
    return this.service.findAll(houseId, residentId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  create(@Body() dto: CreateIncidentDto) {
    return this.service.create(dto);
  }
}
