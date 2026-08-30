import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContatoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  assunto?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  mensagem: string;
}
