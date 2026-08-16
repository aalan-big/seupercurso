import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(3)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  @IsOptional()
  @IsString()
  funcao?: string;
}
