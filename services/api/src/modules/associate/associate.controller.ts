import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { AssociateService } from './associate.service';
import { AssociatePaymentService } from './associate-payment.service';
import { CreateAssociateDto } from './dto/create-associate.dto';
import { UpdateAssociateDto } from './dto/update-associate.dto';

@Controller('associates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssociateController {
  constructor(
    private service: AssociateService,
    private paymentService: AssociatePaymentService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAssociateDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAssociateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /** Cancela a recorrência de cartão do associado (admin faz por ele — sem login). */
  @Post(':id/cancel-subscription')
  @Roles(Role.ADMIN)
  cancelSubscription(@Param('id') id: string) {
    return this.paymentService.cancelSubscription(id);
  }
}
