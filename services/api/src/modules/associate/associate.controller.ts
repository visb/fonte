import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { AssociateService } from './associate.service';
import { AssociatePaymentService } from './associate-payment.service';
import { CreateAssociateDto } from './dto/create-associate.dto';
import { UpdateAssociateDto } from './dto/update-associate.dto';
import { ListAssociatesDto } from './dto/list-associates.dto';

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
  findAll(@Query() query: ListAssociatesDto) {
    return this.service.findAll({ limit: query.limit, offset: query.offset });
  }

  /** Overview de faturamento — DEVE vir antes de :id para não colidir. */
  @Get('overview')
  @Roles(Role.ADMIN)
  getOverview(
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
  ) {
    return this.service.getOverview(months);
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
