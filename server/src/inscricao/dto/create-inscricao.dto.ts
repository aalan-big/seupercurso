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

  /// Caminho devolvido por POST /inscricoes/documento-idoso. Exigido quando o
  /// evento aplica o desconto do idoso e o titular tem 60+ na data da prova.
  @IsOptional()
  @IsString()
  documentoIdosoUrl?: string;
}
