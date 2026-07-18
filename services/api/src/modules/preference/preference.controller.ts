import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PreferenceService } from './preference.service';
import { SetPreferenceDto } from './dto/set-preference.dto';
import { PreferenceKeyParam } from './dto/preference-key.param';

/**
 * Preferências de UI do usuário logado (story 130). Disponível a qualquer
 * usuário autenticado — a preferência é sempre de quem está no token, sem rota
 * para ler/escrever a de outro (decisão 3). Por isso só o JwtAuthGuard, sem
 * RolesGuard.
 */
@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferenceController {
  constructor(private service: PreferenceService) {}

  @Get()
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getAll(user.userId);
  }

  @Put(':key')
  set(
    @Param() { key }: PreferenceKeyParam,
    @Body() dto: SetPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.set(user.userId, key, dto.value);
  }

  @Delete(':key')
  @HttpCode(204)
  remove(
    @Param() { key }: PreferenceKeyParam,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(user.userId, key);
  }
}
