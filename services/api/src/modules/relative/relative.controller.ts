import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('relatives')
@UseGuards(JwtAuthGuard)
export class RelativeController {}
