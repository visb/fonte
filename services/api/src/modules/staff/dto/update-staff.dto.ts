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

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.houseId !== null)
  @IsUUID()
  houseId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.supportGroupId !== null)
  @IsUUID()
  supportGroupId?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn([Role.ADMIN, Role.COORDINATOR, Role.SERVANT])
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(ServantRank)
  rank?: ServantRank | null;
}
