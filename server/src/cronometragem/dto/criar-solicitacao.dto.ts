import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CriarSolicitacaoDto {
  @IsNotEmpty({ message: 'O ID da prova é obrigatório.' })
  @IsUUID('4', { message: 'ID da prova inválido.' })
  prova_id: string;

  @IsNotEmpty({ message: 'A mensagem da solicitação é obrigatória.' })
  @IsString()
  mensagem: string;
}
