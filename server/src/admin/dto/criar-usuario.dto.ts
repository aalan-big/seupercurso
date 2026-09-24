import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsCPF } from '../../common/validators/is-cpf.validator';
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
  @IsCPF({ message: 'CPF inválido. Confira os números digitados.' })
  cpf: string;

  @IsOptional()
  @IsString()
  celular?: string;

  // Obrigatorios: sem eles o cadastro caia em 01/01/2000 e "OUTRO", e o atleta
  // ia para a categoria e o desconto de idoso errados.
  @IsNotEmpty({ message: 'A data de nascimento é obrigatória.' })
  @IsDateString({}, { message: 'Data de nascimento inválida.' })
  dataNascimento: string;

  @IsNotEmpty({ message: 'O gênero é obrigatório.' })
  @IsEnum(Genero, { message: 'Gênero inválido. Use MASCULINO, FEMININO ou OUTRO.' })
  genero: Genero;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  password?: string;
}
