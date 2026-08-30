import { Type } from 'class-transformer';
import { IsEmail, IsString, MinLength, ValidateNested } from 'class-validator';
import { CreateClientePfDto } from '../../cliente/dto/create-cliente-pf.dto';
import { CreateEnderecoDto } from '../../cliente/dto/create-endereco.dto';

export class RegisterCompletoDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @ValidateNested()
  @Type(() => CreateClientePfDto)
  pessoaFisica: CreateClientePfDto;

  @ValidateNested()
  @Type(() => CreateEnderecoDto)
  endereco: CreateEnderecoDto;
}
