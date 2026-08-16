import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateEnderecoDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  cep: string;

  @IsString()
  @IsNotEmpty()
  logradouro: string;

  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  bairro: string;

  @IsString()
  @IsNotEmpty()
  cidade: string;

  @IsString()
  @IsNotEmpty()
  estado: string;

  @IsOptional()
  @IsString()
  pais?: string;
}
