import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ItemPassagemDto {
  @IsNotEmpty()
  @IsString()
  notebook_id: string;

  @IsNotEmpty()
  @IsInt()
  id_local: number;

  @IsUUID('all', { message: 'prova_id inválido.' })
  prova_id: string;

  @IsOptional()
  @IsString()
  atleta_id?: string | null;

  @IsOptional()
  @IsInt()
  numero_peito?: number | null;

  @IsOptional()
  @IsString()
  tag_epc?: string | null;

  @IsNotEmpty()
  @IsString()
  passagem_em: string;

  // O Mark manda ponto/ponto_tipo nulos quando a leitura não caiu em nenhum ponto
  // configurado (antena sem ponto). Essas a plataforma ignora (não entram no resultado).
  @IsOptional()
  @IsString()
  ponto?: string | null;

  @IsOptional()
  @IsIn(['largada', 'parcial', 'chegada', 'portico_unico'])
  ponto_tipo?: 'largada' | 'parcial' | 'chegada' | 'portico_unico' | null;

  @IsOptional()
  @IsIn(['rfid', 'manual'])
  origem?: 'rfid' | 'manual';

  @IsOptional()
  @IsBoolean()
  invalidada?: boolean;
}
