import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';


/**
 * O CPF nao entra aqui de proposito: ele define para qual conta o organizador
 * consegue sacar. Trocar exige solicitacao com foto do documento e aprovacao do
 * admin (SolicitacaoAlteracaoDocumento).
 */
export class UpdateClientePfDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nomeCompleto?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(Genero)
  genero?: Genero;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celular?: string;

  @IsOptional()
  @IsString()
  nacionalidade?: string;
}
