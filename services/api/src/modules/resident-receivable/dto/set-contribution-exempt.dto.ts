import { IsBoolean } from 'class-validator';

export class SetContributionExemptDto {
  @IsBoolean()
  exempt: boolean;
}
