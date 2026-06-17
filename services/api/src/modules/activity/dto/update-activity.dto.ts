import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  houseId?: string | null;

  /** Reatribuir responsável — só ADMIN (validado no service). */
  @IsOptional()
  @IsUUID()
  responsibleStaffId?: string | null;
}
