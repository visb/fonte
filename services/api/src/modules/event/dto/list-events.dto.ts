import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum EventFilterDto {
  ALL = 'all',
  UPCOMING = 'upcoming',
  PAST = 'past',
}

export class ListEventsDto {
  @IsOptional()
  @IsEnum(EventFilterDto)
  filter?: EventFilterDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
