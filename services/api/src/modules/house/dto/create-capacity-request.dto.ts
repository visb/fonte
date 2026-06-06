import { IsInt, Min } from 'class-validator';

export class CreateCapacityRequestDto {
  @IsInt()
  @Min(1)
  generalCapacity: number;

  @IsInt()
  @Min(1)
  staffCapacity: number;
}
