import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateActivityCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
