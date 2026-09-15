import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateMinistryDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  leaderId?: string | null;

  // Story 197: ministério é liderado só por servo. `'RESIDENT'` é recusado aqui
  // (400 do ValidationPipe) e de novo no service, com mensagem de domínio.
  @IsIn(['STAFF'])
  @IsOptional()
  leaderType?: 'STAFF' | null;
}
