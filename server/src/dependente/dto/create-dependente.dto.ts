import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class CreateDependenteDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome completo é obrigatório.' })
  nomeCompleto: string;

  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório.' })
  @IsCPF()
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
