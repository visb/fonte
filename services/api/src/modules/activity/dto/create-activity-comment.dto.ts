import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body é opcional (story 74): um comentário só de áudio é criado com body vazio
 * e o anexo de áudio é enviado em seguida (POST .../comments/:id/attachments).
 * O service normaliza ausência para string vazia.
 */
export class CreateActivityCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
