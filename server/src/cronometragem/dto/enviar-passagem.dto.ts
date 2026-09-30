import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ItemPassagemDto {
  @IsNotEmpty()
  @IsString()
  notebook_id: string;

  @IsNotEmpty()
  @IsInt()
  id_local: number;

  @IsNotEmpty()
  @IsString()
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

  @IsNotEmpty()
  @IsString()
  ponto: string;

  @IsNotEmpty()
  @IsIn(['largada', 'parcial', 'chegada', 'portico_unico'])
  ponto_tipo: 'largada' | 'parcial' | 'chegada' | 'portico_unico';

  @IsOptional()
  @IsIn(['rfid', 'manual'])
  origem?: 'rfid' | 'manual';

  @IsOptional()
  @IsBoolean()
  invalidada?: boolean;
}
