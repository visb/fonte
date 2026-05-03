import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateHouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.coordinatorId !== null)
  @IsUUID()
  coordinatorId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
