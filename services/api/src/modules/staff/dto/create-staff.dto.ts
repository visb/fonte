import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Gender, MaritalStatus, Role, ServantRank } from '@fonte/types';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // E-mail é opcional: nem todo servo recebe acesso aos apps.
  @IsOptional()
  @ValidateIf((o) => o.email !== null && o.email !== '')
  @IsEmail()
  email?: string | null;

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

  // WhatsApp do servo — usado também como identificador de login (story 97).
  @IsOptional()
  @IsString()
  whatsapp?: string | null;

  // Nível do servo (SERVANT). Ignorado para ADMIN/COORDINATOR.
  @IsOptional()
  @IsEnum(ServantRank)
  rank?: ServantRank | null;

  // --- Ficha pessoal (espelha os dados pessoais do filho) ---

  @IsOptional()
  @IsString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  cpf?: string | null;

  @IsOptional()
  @IsString()
  rg?: string | null;

  @IsOptional()
  @IsString()
  nationality?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.gender !== null && o.gender !== '')
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.maritalStatus !== null && o.maritalStatus !== '')
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsString()
  occupation?: string | null;

  @IsOptional()
  @IsString()
  education?: string | null;

  @IsOptional()
  @IsString()
  religion?: string | null;
}
