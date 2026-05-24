import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class GetContributionsReportDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month: string;

  @IsUUID()
  @IsOptional()
  houseId?: string;
}
