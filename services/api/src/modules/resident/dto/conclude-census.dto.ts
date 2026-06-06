import { IsInt, IsUUID, Min } from 'class-validator';

export class ConcludeCensusDto {
  @IsUUID()
  houseId: string;

  @IsInt()
  @Min(0)
  confirmedCount: number;

  @IsInt()
  @Min(0)
  total: number;
}
