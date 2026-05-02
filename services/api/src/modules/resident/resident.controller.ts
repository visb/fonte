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
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';

@Controller('residents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentController {
  constructor(private residentService: ResidentService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<Resident[]> {
    return this.residentService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Resident> {
    return this.residentService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateResidentDto): Promise<Resident> {
    return this.residentService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ): Promise<Resident> {
    return this.residentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.residentService.remove(id);
  }
}
