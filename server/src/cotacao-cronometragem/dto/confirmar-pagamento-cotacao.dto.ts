import { IsOptional, IsUUID } from 'class-validator';

export class ConfirmarPagamentoCotacaoDto {
  // Cronometradora que vai trabalhar na prova: ganha acesso aprovado aos
  // inscritos no Mark. Sem ela, o acesso continua pelo pedido normal.
  @IsOptional()
  @IsUUID()
  cronometradoraId?: string;
}
