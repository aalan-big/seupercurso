import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';

export class CreateDependenteDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome completo é obrigatório.' })
  nomeCompleto: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF deve estar no formato 000.000.000-00 ou conter 11 dígitos.',
  })
  cpf: string;

  @IsDateString({}, { message: 'Data de nascimento inválida.' })
  @IsNotEmpty({ message: 'Data de nascimento é obrigatória.' })
  dataNascimento: string;

  @IsEnum(Genero, { message: 'Gênero inválido.' })
  genero: Genero;

  @IsBoolean()
  @IsOptional()
  pcd?: boolean;

  @IsString()
  @IsOptional()
  celular?: string;
}
