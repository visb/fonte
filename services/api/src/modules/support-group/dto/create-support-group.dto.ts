import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateSupportGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  churchName: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsUUID()
  coordinatorId?: string | null;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;
}
