import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('storerooms')
@UseGuards(JwtAuthGuard)
export class StoreroomController {}
