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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { StoreroomService } from './storeroom.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Controller('storerooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreroomController {
  constructor(private service: StoreroomService) {}

  // â”€â”€ Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('items')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findItems(@Query('houseId') houseId?: string) {
    return this.service.findItems(houseId);
  }

  @Post('items')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  createItem(@Body() dto: CreateItemDto) {
    return this.service.createItem(dto);
  }

  @Patch('items/:id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removeItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeItem(id);
  }

  // â”€â”€ Movements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('movements')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findMovements(
    @Query('houseId') houseId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.service.findMovements(houseId, itemId);
  }

  @Post('movements')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  createMovement(@Body() dto: CreateMovementDto) {
    return this.service.createMovement(dto);
  }
}
