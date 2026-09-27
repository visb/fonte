import { IsDateString, IsOptional, Matches } from 'class-validator';

export class GetHouseProductContributionsDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  referenceMonth?: string;
}
