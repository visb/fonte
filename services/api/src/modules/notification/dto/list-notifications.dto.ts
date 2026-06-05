import { Transform } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, Min } from 'class-validator';

export class ListNotificationsDto {
  // Query strings arrive as 'true'/'false'; validate as boolean-string then coerce.
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;
}
