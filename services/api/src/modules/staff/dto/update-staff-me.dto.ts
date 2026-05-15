import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStaffMeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;
}
