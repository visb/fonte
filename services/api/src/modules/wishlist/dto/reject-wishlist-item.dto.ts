import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectWishlistItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
