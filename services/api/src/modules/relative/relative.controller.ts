import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { Relative } from './relative.entity';
import { RelativeService } from './relative.service';

@Controller('relatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelativeController {
  constructor(private relativeService: RelativeService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findByResident(
    @Query('residentId', ParseUUIDPipe) residentId: string,
  ): Promise<Relative[]> {
    return this.relativeService.findByResident(residentId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateRelativeDto): Promise<Relative> {
    return this.relativeService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.relativeService.remove(id);
  }
}
