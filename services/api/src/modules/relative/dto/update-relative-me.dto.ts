import { IsOptional, IsString } from 'class-validator';

export class UpdateRelativeMeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
