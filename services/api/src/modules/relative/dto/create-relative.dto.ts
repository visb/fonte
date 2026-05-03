import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRelativeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  residentId: string;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsString()
  @IsOptional()
  relationship?: string | null;
}
