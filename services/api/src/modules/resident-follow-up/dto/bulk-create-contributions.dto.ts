import { IsArray, ArrayNotEmpty, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ContributionMonthDto {
  @IsDateString()
  date: string;
}

export class BulkCreateContributionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ContributionMonthDto)
  months: ContributionMonthDto[];
}
