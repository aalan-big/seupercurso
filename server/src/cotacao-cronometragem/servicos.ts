/**
 * Servicos que o organizador pode marcar no pedido. A chave vai para o banco;
 * o rotulo e o que as telas e os e-mails mostram.
 */
export const SERVICOS_CRONOMETRAGEM = {
  CHIP: 'Chip descartável',
  TAPETE: 'Tapetes de leitura',
  PORTICO: 'Pórtico de largada/chegada',
  PONTO_PASSAGEM: 'Pontos de passagem (parciais)',
  RESULTADO_ONLINE: 'Resultado online',
  CERTIFICADO: 'Certificado digital',
} as const;

export type ServicoCronometragem = keyof typeof SERVICOS_CRONOMETRAGEM;

export const CHAVES_SERVICOS = Object.keys(SERVICOS_CRONOMETRAGEM) as ServicoCronometragem[];

export function rotuloServico(chave: string): string {
  return (SERVICOS_CRONOMETRAGEM as Record<string, string>)[chave] ?? chave;
}
