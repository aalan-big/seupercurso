import { IsOptional, IsString, Matches, MinLength } from 'class-validator';


/**
 * O CNPJ nao entra aqui de proposito: ele define para qual conta o organizador
 * consegue sacar. Trocar exige solicitacao com foto do documento e aprovacao do
 * admin (SolicitacaoAlteracaoDocumento).
 */
export class UpdateClientePjDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  nomeResponsavel?: string;

  @IsOptional()
  @IsString()
  documentoResponsavel?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celularComercial?: string;
}
