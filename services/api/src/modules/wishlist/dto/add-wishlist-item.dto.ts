import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddWishlistItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
