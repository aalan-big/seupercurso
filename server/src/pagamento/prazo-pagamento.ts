/** Prazo para pagar: depois disso a vaga volta para a venda. */
export const HORAS_PRAZO_PAGAMENTO = 24;

/** Validade minima de um PIX gerado perto do fim do prazo (o Mercado Pago exige 30 min). */
const MINUTOS_MINIMOS_PIX = 35;

export type ModoExpiracao = 'desligado' | 'simulacao' | 'ativo';

/**
 * EXPIRACAO_INSCRICOES no .env. Sem a variavel nada expira nem manda e-mail:
 * ligar e sempre uma decisao explicita (o ambiente local aponta para um banco).
 */
export function lerModoExpiracao(valor: unknown): ModoExpiracao {
  return valor === 'ativo' || valor === 'simulacao' ? valor : 'desligado';
}

export function prazoPagamento(dataInscricao: Date): Date {
  return new Date(dataInscricao.getTime() + HORAS_PRAZO_PAGAMENTO * 3600_000);
}

/** O PIX vence junto com a vaga, respeitando o minimo do Mercado Pago. */
export function validadePix(dataInscricao: Date, agora = new Date()): Date {
  return new Date(
    Math.max(
      prazoPagamento(dataInscricao).getTime(),
      agora.getTime() + MINUTOS_MINIMOS_PIX * 60_000,
    ),
  );
}
