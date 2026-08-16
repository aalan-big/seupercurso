import { IsString, MinLength } from 'class-validator';

export class ChangeSenhaDto {
  @IsString()
  senhaAtual: string;

  @IsString()
  @MinLength(8)
  novaSenha: string;
}
