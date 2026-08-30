import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Genero } from '../../generated/prisma/enums';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class AtletaManualDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome completo do atleta é obrigatório.' })
  nomeCompleto: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF do atleta é obrigatório.' })
  @IsCPF()
  cpf: string;

  @IsDateString({}, { message: 'Data de nascimento do atleta é inválida.' })
  @IsNotEmpty({ message: 'Data de nascimento do atleta é obrigatória.' })
  dataNascimento: string;

  @IsEnum(Genero, { message: 'Gênero do atleta é inválido.' })
  genero: Genero;

  @IsBoolean()
  @IsOptional()
  pcd?: boolean;
}

export class CreateInscricaoItemDto {
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

  @IsOptional()
  @IsUUID()
  dependenteId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtletaManualDto)
  atleta?: AtletaManualDto;
}

export class CreateInscricaoBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInscricaoItemDto)
  items: CreateInscricaoItemDto[];
}
