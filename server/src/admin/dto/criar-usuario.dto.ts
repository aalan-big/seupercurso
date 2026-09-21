import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Genero } from '../../generated/prisma/enums';

export class CriarUsuarioAdminDto {
  @IsNotEmpty({ message: 'O nome completo é obrigatório.' })
  @IsString()
  nomeCompleto: string;

  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @IsString()
  cpf: string;

  @IsOptional()
  @IsString()
  celular?: string;

  @IsOptional()
  @IsString()
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(Genero, { message: 'Gênero inválido. Use MASCULINO, FEMININO ou OUTRO.' })
  genero?: Genero;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password?: string;
}
