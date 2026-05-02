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
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { House } from './house.entity';
import { HouseService } from './house.service';

@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseController {
  constructor(private houseService: HouseService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<House[]> {
    return this.houseService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<House> {
    return this.houseService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateHouseDto): Promise<House> {
    return this.houseService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHouseDto,
  ): Promise<House> {
    return this.houseService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.houseService.remove(id);
  }
}
