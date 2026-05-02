import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('ministries')
@UseGuards(JwtAuthGuard)
export class MinistryController {}
