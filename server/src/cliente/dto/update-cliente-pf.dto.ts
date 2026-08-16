import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class UpdateClientePfDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nomeCompleto?: string;

  @IsOptional()
  @IsString()
  @IsCPF()
  cpf?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(Genero)
  genero?: Genero;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celular?: string;

  @IsOptional()
  @IsString()
  nacionalidade?: string;
}
