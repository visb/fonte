import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Role } from '@fonte/types';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn([Role.ADMIN, Role.COORDINATOR, Role.OPERATOR])
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
