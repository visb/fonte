import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { FamilyInvestment, MaritalStatus } from '@fonte/types';

export class ReadmitResidentDto {
  @IsUUID()
  houseId: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
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

  @IsOptional()
  @IsString()
  addiction?: string | null;

  @IsOptional()
  @IsString()
  healthIssues?: string | null;

  @IsOptional()
  @IsString()
  continuousMedication?: string | null;

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
}
