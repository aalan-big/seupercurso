import { IsString, MinLength } from 'class-validator';

export class RedefinirSenhaStaffDto {
  @IsString()
  @MinLength(6)
  novaSenha: string;
}
