import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PapelCronometragem, StatusCronometradora } from '../../generated/prisma/enums';

export class CriarCronometradoraDto {
  @IsString({ message: 'Nome da cronometradora é obrigatório.' })
  @IsNotEmpty({ message: 'Nome não pode ser vazio.' })
  nome: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  plano?: string;

  @IsOptional()
  @IsString()
  assinaturaValidaAte?: string;

  @IsOptional()
  @IsInt({ message: 'Limite de computadores deve ser um número inteiro.' })
  @Min(1, { message: 'O limite mínimo é 1 computador.' })
  @Max(100, { message: 'O limite máximo é 100 computadores.' })
  limiteNotebooks?: number;
}

export class AlterarLimiteNotebooksDto {
  @IsInt({ message: 'Limite de computadores deve ser um número inteiro.' })
  @Min(1, { message: 'O limite mínimo é 1 computador.' })
  @Max(100, { message: 'O limite máximo é 100 computadores.' })
  limite: number;
}

export class RenovarAssinaturaDto {
  @IsOptional()
  @IsInt()
  dias?: number;

  @IsOptional()
  @IsInt()
  meses?: number;

  @IsOptional()
  @IsString()
  novaData?: string;
}

export class AlterarStatusCronometradoraDto {
  @IsEnum(StatusCronometradora, { message: 'Status inválido.' })
  status: StatusCronometradora;
}

export class VincularUsuarioCronometradoraDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsOptional()
  @IsEnum(PapelCronometragem, { message: 'Papel deve ser ADMIN ou OPERADOR.' })
  papel?: PapelCronometragem;
}

export class AtualizarUsuarioCronometradoraDto {
  @IsOptional()
  ativo?: boolean;

  @IsOptional()
  desvincular?: boolean;

  @IsOptional()
  @IsEnum(PapelCronometragem)
  papel?: PapelCronometragem;
}
