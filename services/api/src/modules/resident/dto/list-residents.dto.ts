import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ResidentStatus } from '@fonte/types';

/** Colunas permitidas para ordenação (whitelist — nunca interpolar valor recebido). */
export const RESIDENT_SORT_FIELDS = ['name', 'entryDate'] as const;
export type ResidentSortField = (typeof RESIDENT_SORT_FIELDS)[number];

/** Direções permitidas de ordenação. */
export const RESIDENT_SORT_ORDERS = ['asc', 'desc'] as const;
export type ResidentSortOrder = (typeof RESIDENT_SORT_ORDERS)[number];

export class ListResidentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ResidentStatus)
  status?: ResidentStatus;

  @IsOptional()
  @IsUUID()
  houseId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overdueContribution?: boolean;

  // Coluna de ordenação. Default `name` preserva o comportamento atual do
  // endpoint (o ops.fonte depende do alfabético — story 129, decisão 1).
  @IsOptional()
  @IsIn(RESIDENT_SORT_FIELDS)
  sort?: ResidentSortField = 'name';

  @IsOptional()
  @IsIn(RESIDENT_SORT_ORDERS)
  order?: ResidentSortOrder = 'asc';
}
