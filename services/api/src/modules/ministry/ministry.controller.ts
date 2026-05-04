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
import { Ministry } from './ministry.entity';
import { MinistryService } from './ministry.service';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';

@Controller('ministries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinistryController {
  constructor(private service: MinistryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<Ministry[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Ministry> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateMinistryDto): Promise<Ministry> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMinistryDto,
  ): Promise<Ministry> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
