import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
}

export class RenovarAssinaturaDto {
  @IsOptional()
  @IsInt()
  dias?: number;

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
