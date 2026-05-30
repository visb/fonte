import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role, StreetSaleType } from '@fonte/types';
import { StreetSaleService } from './street-sale.service';
import { CreateStreetSaleDto } from './dto/create-street-sale.dto';
import { UpdateStreetSaleDto } from './dto/update-street-sale.dto';
import { GetStreetSalesReportDto } from './dto/get-street-sales-report.dto';

@Controller('street-sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreetSaleController {
  constructor(private service: StreetSaleService) {}

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(
    @Body() dto: CreateStreetSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findAll(
    @Query('houseId') houseId?: string,
    @Query('type') type?: StreetSaleType,
  ) {
    return this.service.findAll(houseId, type);
  }

  @Get('report')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  getReport(@Query() dto: GetStreetSalesReportDto) {
    return this.service.getReport(dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(@Param('id') id: string, @Body() dto: UpdateStreetSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
