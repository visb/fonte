import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Role } from '@fonte/types';
import { PayableService } from './payable.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { ListPayablesDto } from './dto/list-payables.dto';
import { PayablesSummaryDto } from './dto/payables-summary.dto';
import { PayPayableDto } from './dto/pay-payable.dto';

@Controller('payables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PayableController {
  constructor(private service: PayableService) {}

  @Post()
  create(@Body() dto: CreatePayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.userId ?? null);
  }

  @Get()
  findAll(@Query() filters: ListPayablesDto) {
    return this.service.findAll(filters);
  }

  // /summary precede /:id para não ser capturado pela rota de detalhe.
  @Get('summary')
  getSummary(@Query() filters: PayablesSummaryDto) {
    return this.service.getSummary(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayableDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayPayableDto) {
    return this.service.pay(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
