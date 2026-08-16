import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInscricaoDto {
  @IsUUID()
  categoriaId: string;

  @IsUUID()
  loteId: string;

  @IsOptional()
  @IsString()
  tamanhoCamisa?: string;

  @IsOptional()
  @IsString()
  cupomCodigo?: string;
}
