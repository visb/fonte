import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FamilyInvestment } from '@fonte/types';

export class UpdateContributionPlanDto {
  @IsEnum(FamilyInvestment)
  familyInvestment: FamilyInvestment;

  @IsOptional()
  @IsInt()
  familyInvestmentAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  contributionDueDay?: number | null;
}
