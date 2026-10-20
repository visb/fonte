import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FamilyInvestment, Gender, MaritalStatus, ResidentStatus } from '@fonte/types';
import { NormalizeCpf } from '../../../common/lib/cpf';

export class UpdateResidentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  // Story 219: normalizado para dígitos aqui; o DV só é julgado no service
  // quando o CPF MUDA (ficha legada com CPF inválido continua salvável).
  @IsOptional()
  @NormalizeCpf()
  @IsString()
  cpf?: string | null;

  @IsOptional()
  @IsEnum(ResidentStatus)
  status?: ResidentStatus;

  @IsOptional()
  @IsDateString()
  entryDate?: string | null;

  @IsOptional()
  @IsDateString()
  exitDate?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsString()
  rg?: string | null;

  @IsOptional()
  @IsString()
  nationality?: string | null;

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
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => value ?? 0)
  children?: number;

  @IsOptional()
  @IsString()
  occupation?: string | null;

  @IsOptional()
  @IsUUID()
  guardianId?: string | null;

  @IsOptional()
  @IsString()
  education?: string | null;

  @IsOptional()
  @IsString()
  healthIssues?: string | null;

  @IsOptional()
  @IsString()
  continuousMedication?: string | null;

  @IsOptional()
  @IsString()
  religion?: string | null;

  @IsOptional()
  @IsString()
  addiction?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number | null;

  @IsOptional()
  @IsEnum(FamilyInvestment)
  familyInvestment?: FamilyInvestment | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  familyInvestmentAmount?: number | null;

  // Day of month (1-31) the monthly contribution is due. Null falls back to the
  // entry_date day-of-month.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  contributionDueDay?: number | null;

  // Story 205: ministério na ficha. Só filho em acolhimento na casa do
  // ministério (o service valida e devolve 400); `null` tira do ministério.
  @IsOptional()
  @IsUUID()
  ministryId?: string | null;
}
