import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('houses')
@UseGuards(JwtAuthGuard)
export class HouseController {}
