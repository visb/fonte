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

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  houseId: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
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

  @IsOptional()
  @IsUUID()
  ministryId?: string | null;
}
