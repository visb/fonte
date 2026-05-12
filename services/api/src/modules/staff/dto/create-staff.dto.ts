import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@fonte/types';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn([Role.ADMIN, Role.COORDINATOR, Role.OPERATOR])
  role: Role;

  @IsOptional()
  @ValidateIf((o) => o.houseId !== null)
  @IsUUID()
  houseId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
