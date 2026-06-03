import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role, ServantRank } from '@fonte/types';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn([Role.ADMIN, Role.COORDINATOR, Role.SERVANT])
  role: Role;

  @IsOptional()
  @ValidateIf((o) => o.houseId !== null)
  @IsUUID()
  houseId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.supportGroupId !== null)
  @IsUUID()
  supportGroupId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  // Nível do servo (SERVANT). Ignorado para ADMIN/COORDINATOR.
  @IsOptional()
  @IsEnum(ServantRank)
  rank?: ServantRank | null;
}
