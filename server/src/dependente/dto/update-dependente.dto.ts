import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class UpdateDependenteDto {
  @IsOptional()
  @IsString()
  nomeCompleto?: string;

  @IsOptional()
  @IsString()
  @IsCPF()
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida.' })
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(Genero, { message: 'Gênero inválido.' })
  genero?: Genero;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;

  @IsOptional()
  @IsString()
  celular?: string;
}
