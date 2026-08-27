import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';

export class UpdateDependenteDto {
  @IsOptional()
  @IsString()
  nomeCompleto?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF deve estar no formato 000.000.000-00 ou conter 11 dígitos.',
  })
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
