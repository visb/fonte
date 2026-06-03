import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ServantRank } from '@fonte/types';

export class PromoteToServantDto {
  // Data em que a promoção aconteceu. Default: hoje. Usada na alta do filho,
  // no evento da timeline e no registro do servo.
  @IsOptional()
  @IsDateString()
  date?: string;

  // Obrigatórios apenas quando o interno ainda não tem acesso (User). Se já tem,
  // a conta de kiosk é reaproveitada e estes campos são ignorados.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  // Casa do servo. Default: a casa atual do interno.
  @IsOptional()
  @IsUUID()
  houseId?: string;

  // Nível inicial do servo. Default: ASPIRANTE.
  @IsOptional()
  @IsEnum(ServantRank)
  rank?: ServantRank;
}
