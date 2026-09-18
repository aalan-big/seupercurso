import { IsEmail, IsString } from 'class-validator';

export class ChangeEmailDto {
  @IsString()
  senhaAtual!: string;

  @IsEmail()
  novoEmail!: string;
}
